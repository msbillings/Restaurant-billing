const http = require('http');

/**
 * Check if the server is running on the specified port
 */
function checkServer(port = 5000, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: port,
        path: '/api/bills',
        method: 'GET',
        timeout: timeout,
      },
      (res) => {
        // Server is running (even if it returns an error, it means server is up)
        resolve(true);
      }
    );

    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        resolve(false);
      } else {
        reject(err);
      }
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Main execution
const port = process.env.PORT || 5000;
console.log(`Checking if server is running on port ${port}...`);

checkServer(port)
  .then((isRunning) => {
    if (!isRunning) {
      console.error('\n❌ Server is not running!');
      console.error(`\nPlease start the server first:`);
      console.error(`  npm start`);
      console.error(`  or`);
      console.error(`  npm run dev\n`);
      console.error(`Make sure MongoDB is also running.\n`);
      process.exit(1);
    } else {
      console.log('✓ Server is running\n');
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error('Error checking server:', error.message);
    process.exit(1);
  });

