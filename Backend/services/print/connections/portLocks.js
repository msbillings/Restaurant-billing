import { exec, execFile } from 'child_process';

export const btComPortCache = new Map();
export const usbPrinterCache = new Map();

const printerLocks = new Map();

export async function withPrinterLock(printerName, task) {
  const key = printerName || 'default_usb';
  let currentLock = printerLocks.get(key) || Promise.resolve();
  let release;
  const nextLock = new Promise(resolve => { release = resolve; });
  printerLocks.set(key, currentLock.then(() => nextLock).catch(() => nextLock));

  try {
    await currentLock;
    return await task();
  } finally {
    release();
  }
}

export const execPromise = (cmd, opts) => {
  return new Promise((resolve, reject) => {
    let isDone = false;
    let child;
    const timer = setTimeout(() => {
      if (isDone) return;
      isDone = true;
      try { if (child) child.kill('SIGKILL'); } catch (e) { }
      reject(new Error('Process execution timed out strictly'));
    }, opts?.timeout || 15000);

    child = exec(cmd, opts, (error, stdout, stderr) => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timer);
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        return reject(error);
      }
      resolve({ stdout, stderr });
    });
  });
};

export const execFilePromise = (exe, args, opts) => {
  return new Promise((resolve, reject) => {
    let isDone = false;
    let child;
    const timer = setTimeout(() => {
      if (isDone) return;
      isDone = true;
      try { if (child) child.kill('SIGKILL'); } catch (e) { }
      reject(new Error('Process execution timed out strictly'));
    }, opts?.timeout || 15000);

    child = execFile(exe, args, opts, (error, stdout, stderr) => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timer);
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        return reject(error);
      }
      resolve({ stdout, stderr });
    });
  });
};
