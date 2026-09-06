const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { normalizeBackendUrl } = require('../config/backend.cjs');

const root = path.resolve(__dirname, '..');
const settingsFile = path.join(root, 'backend.config.json');
const backendRoot = path.resolve(root, '../odoo-server');

function localPort() {
  // Only read PORT; never copy backend secrets into the app environment.
  const source = fs.existsSync(path.join(backendRoot, '.env')) ? fs.readFileSync(path.join(backendRoot, '.env'), 'utf8') : '';
  const port = Number(process.env.APP_BACKEND_PORT || source.match(/^\s*PORT\s*=\s*["']?(\d+)/m)?.[1] || 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('APP_BACKEND_PORT must be a valid port.');
  return port;
}

function lanHost(interfaces = os.networkInterfaces()) {
  const entries = Object.entries(interfaces).sort(([a], [b]) => Number(!/^(en0|wlan0|wi-fi)$/i.test(a)) - Number(!/^(en0|wlan0|wi-fi)$/i.test(b)));
  for (const [name, addresses] of entries) {
    if (/^(docker|veth|utun|tun|bridge|vmnet)/i.test(name)) continue;
    const found = addresses?.find(item => item.family === 'IPv4' && !item.internal && !item.address.startsWith('169.254.'));
    if (found) return found.address;
  }
  throw new Error('No LAN address found. Connect to Wi-Fi or supply --url https://your-backend-domain');
}

async function checkHealth(base, fetcher = fetch) {
  const response = await fetcher(`${base}/health`, { signal: AbortSignal.timeout(4000), redirect: 'error' });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success !== true) throw new Error(`Backend health check failed (HTTP ${response.status}). Use the backend URL, not the website URL.`);
}

function options(args) {
  const mode = args.shift() || 'dev';
  if (!['dev', 'production', 'check'].includes(mode)) throw new Error('Usage: npm run connect -- [dev | production --url https://host | check]');
  const opts = { mode, expo: [] };
  while (args.length) {
    const flag = args.shift();
    if (flag === '--url') {
      const value = args.shift();
      if (!value || value.startsWith('--')) throw new Error('--url requires a backend address.');
      opts.url = value;
    } else if (flag === '--check-only' && mode === 'dev') opts.checkOnly = true;
    else if (['--android', '--ios', '--web', '--clear'].includes(flag) && mode === 'dev') opts.expo.push(flag);
    else throw new Error(`Unknown option: ${flag}`);
  }
  return opts;
}

async function main(args = process.argv.slice(2)) {
  const opts = options(args);
  if (opts.mode !== 'dev') {
    const saved = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    const url = normalizeBackendUrl(opts.url || process.env.APP_PRODUCTION_API_URL || saved.productionUrl || process.env.EXPO_PUBLIC_API_URL, { production: true });
    await checkHealth(url);
    if (opts.mode === 'production') {
      // Public URL only. Keep this tracked file with app sources for cloud builds.
      const temp = `${settingsFile}.${process.pid}.tmp`;
      fs.writeFileSync(temp, JSON.stringify({ ...saved, productionUrl: url }, null, 2) + '\n', { flag: 'wx' });
      fs.renameSync(temp, settingsFile);
      console.log(`Saved production backend: ${url}\nFuture release builds use this address. Commit backend.config.json before cloud builds.`);
    } else console.log(`Production backend is reachable: ${url}`);
    return;
  }

  const port = localPort();
  const url = normalizeBackendUrl(opts.url || `http://${lanHost()}:${port}`);
  if (opts.checkOnly) { await checkHealth(url); console.log(`App backend is reachable: ${url}`); return; }
  let server;
  let metro;
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    metro?.kill('SIGTERM');
    server?.kill('SIGTERM');
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    if (!opts.url) {
      try { await checkHealth(`http://127.0.0.1:${port}/api`); }
      catch {
        let entry;
        try { entry = require.resolve('tsx', { paths: [backendRoot] }); }
        catch { throw new Error('Backend dependencies are missing. Run npm install in ../odoo-server once.'); }
        console.log('Starting the local backend…');
        server = spawn(process.execPath, ['--import', entry, 'src/server.ts'], { cwd: backendRoot, stdio: 'inherit', env: { ...process.env, PORT: String(port) } });
        server.on('error', error => console.error(error.message));
        let ready = false;
        for (let attempt = 0; attempt < 20 && !stopping; attempt++) {
          if (server.exitCode !== null) throw new Error('Backend exited. Check its database/Redis configuration above.');
          try { await checkHealth(`http://127.0.0.1:${port}/api`); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 500)); }
        }
        if (!ready) throw new Error('Backend did not become ready. Check PostgreSQL, Redis and backend .env.');
      }
    }
    if (stopping) return;
    await checkHealth(url);
    console.log(`App connected to ${url}\nKeep the phone and computer on the same network. No .env edits needed.`);
    const expo = require.resolve('expo/bin/cli');
    metro = spawn(process.execPath, [expo, 'start', ...opts.expo], {
      cwd: root, stdio: 'inherit', env: { ...process.env, EXPO_PUBLIC_API_URL: url },
    });
    await new Promise((resolve, reject) => { metro.once('error', reject); metro.once('exit', code => { if (code && !stopping) process.exitCode = code; resolve(); }); });
  } finally {
    stop();
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

module.exports = { options, lanHost, checkHealth };
if (require.main === module) main().catch(error => { console.error(`Connection setup: ${error.message}`); process.exitCode = 1; });
