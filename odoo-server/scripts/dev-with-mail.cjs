const { spawn } = require('node:child_process');
const children = ['dev', 'worker:payroll'].map(command =>
  spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', command], { stdio: 'inherit', detached: process.platform !== 'win32' }));
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try { process.platform === 'win32' ? child.kill('SIGTERM') : process.kill(-child.pid, 'SIGTERM'); } catch {}
  }
  Promise.all(children.map(child => child.exitCode !== null ? Promise.resolve() : new Promise(resolve => child.once('exit', resolve))))
    .then(() => process.exit(code));
  setTimeout(() => {
    for (const child of children) { try { process.platform === 'win32' ? child.kill('SIGKILL') : process.kill(-child.pid, 'SIGKILL'); } catch {} }
    process.exit(code);
  }, 10000).unref();
}
for (const child of children) {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => stop(code || 0));
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
