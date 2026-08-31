const https = require('https');

async function testEndpoint(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data: data.substring(0, 300) });
      });
    }).on('error', (e) => {
      resolve({ error: e.message });
    });
  });
}

async function runTests() {
  console.log("Testing msbillings-superadmin.vercel.app...\n");
  
  const rootResult = await testEndpoint('https://msbillings-superadmin.vercel.app/');
  console.log(`[GET /] Status: ${rootResult.status}`);
  console.log(`Response snippet: ${rootResult.data}\n`);

  const apiResult = await testEndpoint('https://msbillings-superadmin.vercel.app/api/health');
  console.log(`[GET /api/health] Status: ${apiResult.status}`);
  console.log(`Response snippet: ${apiResult.data}\n`);
}

runTests();
