import cron from 'node-cron';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import ClientDefault from '../models/Client.js';
import { getTenantModels } from './tenantManager.js';

/**
 * Filters a user's activeSessions array, keeping only sessions whose
 * access token AND refresh token are both unexpired.
 * Uses jwt.decode (no verification) because the secret is not available
 * in this background context — we only need the exp claim.
 *
 * @param {Array} sessions
 * @param {number} nowMs - Date.now() snapshot
 * @returns {{ kept: Array, removed: number }}
 */
const filterExpiredSessions = (sessions, nowMs) => {
  let removed = 0;
  const kept = (sessions || []).filter(session => {
    try {
      const accessDecoded = jwt.decode(session.accessToken);
      if (!accessDecoded || accessDecoded.exp * 1000 < nowMs) {
        removed++;
        return false;
      }
      const refreshDecoded = jwt.decode(session.refreshToken);
      if (!refreshDecoded || refreshDecoded.exp * 1000 < nowMs) {
        removed++;
        return false;
      }
      return true;
    } catch (_err) {
      removed++;
      return false; // malformed session token — remove it
    }
  });
  return { kept, removed };
};

/**
 * Cleans expired sessions for all users found by the given User model.
 * Operates within a single tenant database connection.
 *
 * @param {Object} UserModel - Mongoose model scoped to the tenant DB
 * @param {string} label    - Human-readable label for logging (e.g. 'master' or 'tenant=xyz')
 * @returns {{ usersScanned: number, usersChanged: number, sessionsRemoved: number }}
 */
const cleanSessionsForDatabase = async (UserModel, label) => {
  const nowMs = Date.now();
  let usersScanned = 0;
  let usersChanged = 0;
  let sessionsRemoved = 0;

  // Only select the fields needed — avoids pulling the full document unnecessarily
  const users = await UserModel.find({}).select('activeSessions username').lean(false);

  for (const user of users) {
    usersScanned++;
    const { kept, removed } = filterExpiredSessions(user.activeSessions, nowMs);

    if (removed > 0) {
      try {
        user.activeSessions = kept;
        await user.save();
        usersChanged++;
        sessionsRemoved += removed;
      } catch (saveErr) {
        // Log the failure but do NOT replace the session array in-memory.
        // The user document in MongoDB is unchanged — no corruption risk.
        console.error(
          `[Session Cleanup] Failed to save user (${label}):`,
          saveErr.message
        );
      }
    }
  }

  return { usersScanned, usersChanged, sessionsRemoved };
};

/**
 * Background job to clean up expired sessions across ALL tenant databases
 * and the master database.
 *
 * Runs every hour at minute 0.
 * Uses a 5-minute distributed Redis lock to prevent duplicate execution
 * across horizontally-scaled server instances.
 *
 * Tenant identity is derived exclusively from the authoritative Client registry
 * (master DB → clients collection). No HTTP headers, query params, or
 * user-supplied input are accepted.
 */
const startSessionCleanupJob = () => {
  cron.schedule('0 * * * *', async () => {
    // ── Distributed lock ──────────────────────────────────────────────────
    const { default: redisClient } = await import('./redisClient.js');
    // Lock TTL: 5 minutes (300 s). The hourly cron can take up to this long
    // before the lock is automatically released.
    const lockToken = await redisClient.acquireLock('cron:session_cleanup:lock', 300);
    if (!lockToken) {
      console.log('[Session Cleanup] Skipping cleanup (lock acquired by another worker node or Redis unavailable)');
      return;
    }

    try {
    const jobStart = Date.now();
    console.log('[Session Cleanup] Running scheduled cleanup...');

    // ── Discover all active tenants from the authoritative Client registry ──
    let tenantDatabases = [];
    if (mongoose.connection.readyState === 1) {
      try {
        const clients = await ClientDefault
          .find({ status: { $ne: 'Inactive' } })
          .select('databaseName')
          .lean();
        tenantDatabases = clients.map(c => c.databaseName).filter(Boolean);
        console.log(`[Session Cleanup] Discovered ${tenantDatabases.length} tenant(s) from Client registry`);
      } catch (discoveryErr) {
        console.error('[Session Cleanup] Failed to query Client registry:', discoveryErr.message);
        // Do not abort — still attempt master DB cleanup below
      }
    } else {
      console.warn('[Session Cleanup] Master DB not connected — skipping tenant discovery');
    }

    let grandTotal = { usersScanned: 0, usersChanged: 0, sessionsRemoved: 0 };

    // ── Clean each tenant database ────────────────────────────────────────
    for (const tenantDb of tenantDatabases) {
      const tenantStart = Date.now();
      try {
        const models = await getTenantModels(tenantDb);
        const result = await cleanSessionsForDatabase(models.User, `tenant=${tenantDb}`);
        grandTotal.usersScanned += result.usersScanned;
        grandTotal.usersChanged += result.usersChanged;
        grandTotal.sessionsRemoved += result.sessionsRemoved;
        console.log(
          `[Session Cleanup] tenant=${tenantDb} ` +
          `usersScanned=${result.usersScanned} ` +
          `usersChanged=${result.usersChanged} ` +
          `sessionsRemoved=${result.sessionsRemoved} ` +
          `durationMs=${Date.now() - tenantStart}`
        );
      } catch (tenantErr) {
        // Tenant DB unavailable or model resolution failed — log and continue.
        // NEVER expose connection strings or credentials in the log.
        console.error(`[Session Cleanup] Error cleaning tenant=${tenantDb}: ${tenantErr.message}`);
      }
    }

    // ── Clean master database users ───────────────────────────────────────
    // Master-DB users (super-admin accounts, etc.) also accumulate stale sessions.
    // We use the global User model that is already compiled on the primary connection.
    // This is intentionally separate from the tenant loop above.
    if (mongoose.connection.readyState === 1) {
      const masterStart = Date.now();
      try {
        // Import the global User model at runtime to avoid circular-import issues.
        const { default: GlobalUser } = await import('../models/User.js');
        const result = await cleanSessionsForDatabase(GlobalUser, 'master');
        grandTotal.usersScanned += result.usersScanned;
        grandTotal.usersChanged += result.usersChanged;
        grandTotal.sessionsRemoved += result.sessionsRemoved;
        console.log(
          `[Session Cleanup] master ` +
          `usersScanned=${result.usersScanned} ` +
          `usersChanged=${result.usersChanged} ` +
          `sessionsRemoved=${result.sessionsRemoved} ` +
          `durationMs=${Date.now() - masterStart}`
        );
      } catch (masterErr) {
        console.error(`[Session Cleanup] Error cleaning master DB: ${masterErr.message}`);
      }
    }

    const totalDurationMs = Date.now() - jobStart;
    console.log(
      `[Session Cleanup] Complete. ` +
      `tenantsProcessed=${tenantDatabases.length} ` +
      `totalUsersScanned=${grandTotal.usersScanned} ` +
      `totalUsersChanged=${grandTotal.usersChanged} ` +
      `totalSessionsRemoved=${grandTotal.sessionsRemoved} ` +
      `durationMs=${totalDurationMs}`
    );
    } finally {
      await redisClient.releaseLock('cron:session_cleanup:lock', lockToken);
    }
  });

  console.log('[Session Cleanup] Background job started - runs every hour');
};

export default startSessionCleanupJob;
export { filterExpiredSessions, cleanSessionsForDatabase };
