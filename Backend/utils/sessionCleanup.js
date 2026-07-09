import cron from 'node-cron';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

/**
 * Background job to clean up expired sessions
 * Runs every hour to remove sessions with expired access or refresh tokens
 * This prevents stale sessions from blocking new logins
 */
const startSessionCleanupJob = () => {
    // Run every hour at minute 0
    cron.schedule('0 * * * *', async () => {
        try {
            console.log('[Session Cleanup] Running scheduled cleanup...');
            const users = await User.find({});
            let totalCleaned = 0;

            for (const user of users) {
                const now = new Date();
                const originalLength = user.activeSessions.length;

                user.activeSessions = user.activeSessions.filter(session => {
                    try {
                        // Check access token expiry
                        const accessDecoded = jwt.decode(session.accessToken);
                        if (!accessDecoded || accessDecoded.exp * 1000 < now.getTime()) {
                            return false; // Remove expired access token
                        }

                        // Check refresh token expiry
                        const refreshDecoded = jwt.decode(session.refreshToken);
                        if (!refreshDecoded || refreshDecoded.exp * 1000 < now.getTime()) {
                            return false; // Remove expired refresh token
                        }

                        return true; // Keep valid session
                    } catch (err) {
                        return false; // Remove invalid session
                    }
                });

                if (user.activeSessions.length !== originalLength) {
                    await user.save();
                    const cleaned = originalLength - user.activeSessions.length;
                    totalCleaned += cleaned;
                    console.log(`[Session Cleanup] Cleaned ${cleaned} expired session(s) for user: ${user.username}`);
                }
            }

            console.log(`[Session Cleanup] Total sessions cleaned: ${totalCleaned}`);
        } catch (error) {
            console.error('[Session Cleanup] Error during cleanup:', error);
        }
    });

    console.log('[Session Cleanup] Background job started - runs every hour');
};

export default startSessionCleanupJob;
