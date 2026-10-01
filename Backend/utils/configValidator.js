/**
 * Phase 3: Configuration Validation
 *
 * This module ensures the application fails fast if required environment
 * variables are missing, preventing the app from running in an unpredictable state.
 */

export const validateConfig = () => {
  const requiredEnvVars = [
    'MONGO_URI',
    'JWT_SECRET',
    'PORT'
  ];

  const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missingVars.length > 0) {
    console.error('======================================================');
    console.error('🚨 CRITICAL ERROR: MISSING ENVIRONMENT VARIABLES 🚨');
    console.error('======================================================');
    console.error(`The following required environment variables are missing:`);
    missingVars.forEach(v => console.error(` - ${v}`));
    console.error('======================================================');
    console.error('Application cannot start safely. Exiting now.');
    process.exit(1);
  }

  // Validate optional but recommended secrets for cloud envs
  const isCloud = !!(process.env.RENDER || process.env.VERCEL || process.env.NODE_ENV === 'production');
  if (isCloud) {
    if (!process.env.CORS_ORIGIN) {
      console.warn('⚠️ WARNING: CORS_ORIGIN is not set. Assuming open CORS for API testing, but this is unsafe for production.');
    }
  }

  console.log('✅ Configuration Validation: SUCCESS (All required secrets found)');
};
