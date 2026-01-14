// Quick test script for webhook endpoints
const http = require('http');

const endpoints = [
  { method: 'GET', path: '/' },
  { method: 'GET', path: '/webhooks/health' },
  { method: 'GET', path: '/webhooks/status' },
];

async function testEndpoint(method, path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: path,
      method: method,
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`${method} ${path} => ${res.statusCode}`);
        if (data) console.log(`   Response: ${data.substring(0, 100)}`);
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', (err) => {
      console.log(`${method} ${path} => ERROR: ${err.message}`);
      resolve({ error: err.message });
    });

    req.on('timeout', () => {
      console.log(`${method} ${path} => TIMEOUT`);
      req.destroy();
      resolve({ error: 'timeout' });
    });

    req.end();
  });
}

async function runTests() {
  console.log('Testing backend endpoints...\n');
  
  for (const { method, path } of endpoints) {
    await testEndpoint(method, path);
  }
  
  console.log('\nDone.');
}

runTests();
