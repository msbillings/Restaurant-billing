const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');

const backendPath = path.join(__dirname, 'Backend');
const serverPath = path.join(backendPath, 'server.js');
const userDataPath = path.join(__dirname, 'temp_user_data');

if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

console.log('Starting backend fork...');
const backendProcess = fork(serverPath, [], {
  cwd: backendPath,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    APP_USER_DATA_PATH: userDataPath
  },
  stdio: 'pipe'
});

backendProcess.stdout.on('data', (data) => {
  console.log(`[BACKEND]: ${data}`);
});

backendProcess.stderr.on('data', (data) => {
  console.error(`[BACKEND ERR]: ${data}`);
});

backendProcess.on('error', (err) => {
  console.error('Failed to start backend server.', err);
});

backendProcess.on('exit', (code, signal) => {
  console.log(`Backend process exited with code ${code} and signal ${signal}`);
  process.exit(code || 0);
});

setTimeout(() => {
  console.log('Backend has been running for 10 seconds perfectly. Killing it now.');
  backendProcess.kill();
}, 10000);
