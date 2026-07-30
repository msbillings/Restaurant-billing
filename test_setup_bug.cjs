const http = require('http');

const data = JSON.stringify({
  databaseName: 'starchicken_db',
  username: 'admin@starchicken.com',
  password: 'starchicken',
  staffAccounts: []
});

const options = {
  hostname: 'localhost',
  port: 5002,
  path: '/api/config/setup',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.on('error', console.error);
req.write(data);
req.end();
