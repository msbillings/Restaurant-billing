import { getMasterModels } from './tenantManager.js';
import redisClient from './redisClient.js';

export const handleFailedJob = async (queueName, job, error) => {
  try {
    const isFinalFailure = (job.attemptsMade >= (job.opts?.attempts || 1)) || error.name === 'UnrecoverableError';

    if (!isFinalFailure) {
      return; // Will be retried by BullMQ naturally
    }

    const tenantDb = job.data?.tenantDb;
    if (!tenantDb || tenantDb === 'default' || tenantDb === 'undefined' || tenantDb === 'null') {
      console.error(`[DLQ Manager] Job ${job.id} from ${queueName} failed without a valid tenantDb. Cannot safely persist to DLQ.`);
      return;
    }

    const models = await getMasterModels();
    const DeadLetterJob = models.DeadLetterJob;
    if (!DeadLetterJob) {
      console.error(`[DLQ Manager] Failed to resolve DeadLetterJob model.`);
      return;
    }

    if (job.data && job.data._replayedFrom) {
      // This is a failure of a replayed job
      await DeadLetterJob.updateOne(
        { _id: job.data._replayedFrom },
        {
          $set: { status: 'FAILED', lastFailedAt: new Date() },
          $push: { metadata: { failedReplayAttempt: job.data._replayAttempt, reason: error.message } }
        }
      );
      console.log(`[DLQ Manager] Replayed job ${job.id} failed again and DLQ record ${job.data._replayedFrom} was updated.`);
      return;
    }

    // Atomically upsert the DLQ record to support exactly-once storage despite multiple possible failure hooks
    await DeadLetterJob.findOneAndUpdate(
      { originalQueue: queueName, originalJobId: job.id },
      {
        $set: {
          jobName: job.name,
          tenantDb,
          payload: job.data,
          failureReason: error.message || 'Unknown error',
          errorClass: error.name || 'Error',
          attemptsMade: job.attemptsMade,
          lastFailedAt: new Date(),
          status: 'FAILED'
        },
        $setOnInsert: {
          firstFailedAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log(`[DLQ Manager] Job ${job.id} permanently failed and persisted to DLQ for tenant ${tenantDb}.`);
  } catch (err) {
    console.error(`[DLQ Manager] Critical error saving job ${job?.id} to DLQ:`, err.message);
  }
};

export const replayDeadLetterJob = async (dlqRecordId) => {
  const models = await getMasterModels();
  const DeadLetterJob = models.DeadLetterJob;

  const dlqJob = await DeadLetterJob.findById(dlqRecordId);
  if (!dlqJob) {
    throw new Error('DeadLetterJob not found.');
  }

  const tenantDb = dlqJob.tenantDb;
  if (!tenantDb || tenantDb === 'default' || tenantDb === 'undefined' || tenantDb === 'null') {
    throw new Error('Tenant database is missing from DLQ record. Cannot safely replay.');
  }

  if (dlqJob.status === 'BLOCKED' || dlqJob.replayCount >= dlqJob.maxReplays) {
    dlqJob.status = 'BLOCKED';
    await dlqJob.save();
    throw new Error('DeadLetterJob has exceeded replay limits or is blocked.');
  }

  // Atomicity for concurrency protection
  const lockToken = await redisClient.acquireLock(`dlq:replay:${tenantDb}:${dlqJob.originalJobId}`, 30);
  if (!lockToken) {
    throw new Error('DeadLetterJob replay is already in progress.');
  }

  try {
    const queueManager = await import('../workers/queueManager.js');
    const queueMap = {
      'WhatsAppQueue': queueManager.WhatsAppQueue,
      'ReportQueue': queueManager.ReportQueue
    };

    const targetQueue = queueMap[dlqJob.originalQueue];
    if (!targetQueue) {
      throw new Error(`Queue ${dlqJob.originalQueue} is not supported for replay.`);
    }

    // Safely inject replay metadata audit trail
    // Overriding tenantDb ensures malicious replays cannot mutate the original job's intended isolation.
    const replayPayload = {
      ...dlqJob.payload,
      _replayedFrom: dlqJob._id.toString(),
      _replayAttempt: dlqJob.replayCount + 1,
      tenantDb
    };

    const newJob = await targetQueue.add(dlqJob.jobName, replayPayload);

    // Atomic update status
    await DeadLetterJob.updateOne(
      { _id: dlqJob._id },
      {
        $set: { status: 'REPLAY_QUEUED' },
        $inc: { replayCount: 1 }
      }
    );

    return { success: true, newJobId: newJob.id };
  } finally {
    await redisClient.releaseLock(`dlq:replay:${tenantDb}:${dlqJob.originalJobId}`, lockToken);
  }
};

export const handleReplayedJobSuccess = async (job) => {
  try {
    if (!job || !job.data || !job.data._replayedFrom) return;

    const models = await getMasterModels();
    const DeadLetterJob = models.DeadLetterJob;

    await DeadLetterJob.updateOne(
      { _id: job.data._replayedFrom },
      { $set: { status: 'REPLAYED' } }
    );
    console.log(`[DLQ Manager] Replayed job ${job.id} completed successfully. DLQ record ${job.data._replayedFrom} marked as REPLAYED.`);
  } catch (err) {
    console.error(`[DLQ Manager] Error updating DLQ record on success:`, err.message);
  }
};
