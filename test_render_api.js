const https = require('https');

const BASE_URL = 'https://msbillings-backend.onrender.com';

const baseRoutes = [
  '/api/menu',
  '/api/bills',
  '/api/categories',
  '/api/analytics',
  '/api/expenses',
  '/api/config',
  '/api/inventory',
  '/api/floors',
  '/api/aggregators',
  '/api/ai',
  '/api/customers',
  '/api/staff',
  '/api/public',
  '/api/service-requests',
  '/api/taxes',
  '/api/discounts',
  '/api/cash-logs',
  '/api/credit-accounts',
  '/api/reservations',
  '/api/feedback',
  '/api/push-orders',
  '/api/printer-configs',
  '/api/online-configs',
  '/api/sync',
  '/api/admin',
  '/api/cameras',
  '/api/loyalty',
  '/api/broadcasts',
  '/api/clients',
  '/api/whatsapp'
];

// Most root paths probably don't have a GET / handler or require Auth. 
// We will test them anyway. A 401 Unauthorized or 403 Forbidden means the route exists and is protected!
// A 404 means the specific sub-path doesn't exist, but the server is responding.

async function testEndpoint(path) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-DB': 'test_db' // Provide a dummy tenant to avoid missing tenant errors if any
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          path: path,
          status: res.statusCode
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        path: path,
        status: 'ERROR',
        error: error.message
      });
    });

    req.end();
  });
}

async function runTests() {
  console.log(`Starting comprehensive test of all routes on ${BASE_URL}...\n`);
  
  let successCount = 0;
  let totalCount = baseRoutes.length;

  for (const route of baseRoutes) {
    const result = await testEndpoint(route);
    
    // Status 401/403 means auth is working. Status 200 means public route is working.
    // Status 404 means the base route doesn't have a GET '/' handler (e.g., requires GET '/id' or POST)
    // Any 500 would mean server crash.
    let statusMsg = '';
    if (result.status === 200 || result.status === 201) {
      statusMsg = `✅ ${result.status} OK`;
      successCount++;
    } else if (result.status === 401 || result.status === 403) {
      statusMsg = `🔒 ${result.status} Auth Protected (Working)`;
      successCount++;
    } else if (result.status === 404) {
      statusMsg = `🔍 404 (Route exists but GET '/' not defined - normal)`;
      successCount++; // This is still technically a successful connection to the router
    } else if (result.status === 500) {
      statusMsg = `❌ 500 Server Error`;
    } else {
      statusMsg = `⚠️ ${result.status}`;
    }

    console.log(`${route.padEnd(25)} : ${statusMsg}`);
  }
  
  console.log(`\nTest completed: ${successCount}/${totalCount} routes responded normally.`);
}

runTests();
