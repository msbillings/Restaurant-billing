import redisClient from './services/redisClient.js';

setTimeout(() => {
  console.log('Testing connection...');
  if (redisClient) {
    redisClient.ping().then(res => {
      console.log('✅ Ping response:', res);
      process.exit(0);
    }).catch(err => {
      console.error('❌ Ping failed:', err);
      process.exit(1);
    });
  } else {
    console.log('No redis client initialized');
    process.exit(1);
  }
}, 1500);
