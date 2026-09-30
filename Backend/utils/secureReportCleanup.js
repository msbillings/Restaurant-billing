import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import Report from '../models/Report.js';

export const startSecureReportCleanupJob = () => {
  // Run every hour at minute 15
  cron.schedule('15 * * * *', async () => {
    // Phase 6: Distributed Cron Lock
    const { default: redisClient } = await import('./redisClient.js');
    const lockAcquired = await redisClient.acquireLock('cron:secure_report_cleanup:lock', 300); // 5 minute lock
    if (!lockAcquired) {
      console.log('[Secure Report Cleanup] Skipping cleanup (lock acquired by another worker node)');
      return;
    }

    try {
      console.log('[Secure Report Cleanup] Running scheduled cleanup...');
      
      const secureDir = path.join(process.cwd(), 'secure_reports');
      if (!fs.existsSync(secureDir)) {
        return;
      }

      // Read all files in the secure directory
      const files = fs.readdirSync(secureDir);
      
      // MongoDB TTL index handles deleting expired document metadata after 24 hours.
      // So we just need to delete physical files that no longer have a corresponding MongoDB document.
      let cleanedCount = 0;
      
      for (const file of files) {
        // Files are named <reportId>.csv or <reportId>.xlsx
        const reportId = file.split('.')[0];
        if (!reportId) continue;
        
        const reportDoc = await Report.findOne({ reportId }).lean();
        
        // If document doesn't exist (expired via TTL) OR status is explicitly expired
        if (!reportDoc || reportDoc.status === 'expired') {
          const filePath = path.join(secureDir, file);
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              cleanedCount++;
            }
          } catch (unlinkErr) {
            console.error(`[Secure Report Cleanup] Failed to delete file ${file}:`, unlinkErr.message);
          }
        }
      }

      if (cleanedCount > 0) {
        console.log(`[Secure Report Cleanup] Successfully deleted ${cleanedCount} expired physical report files.`);
      }
    } catch (error) {
      console.error('[Secure Report Cleanup] Error during cleanup:', error);
    }
  });

  console.log('[Secure Report Cleanup] Background job started - runs every hour at minute 15');
};
