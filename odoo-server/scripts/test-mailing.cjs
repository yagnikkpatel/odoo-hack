// Full mailing integration test. Uses a disposable PostgreSQL database, its own
// Redis container, and an SMTP sink bound to loopback. Never uses real SMTP.
const assert = require('node:assert/strict');
const net = require('node:net');
const { randomUUID } = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { PDFDocument } = require('pdf-lib');
require('dotenv').config({ quiet: true });
const root = path.resolve(__dirname, '..');
const database = `mail_test_${randomUUID().replaceAll('-', '')}`;
const container = `mail-test-${randomUUID().slice(0, 8)}`;
const admin = new Pool({ connectionString: process.env.DATABASE_URL });
const processes = [];
const messages = [];
const rcpts = new Map();
const sockets = new Set();
let db, runtime, queue, redisModule, dbModule, redisStarted = false, databaseCreated = false;
let worker;

const smtp = net.createServer(socket => {
  sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {});
  socket.write('220 localhost test SMTP\r\n');
  let buffer = '', collecting = false, body = [], recipient = '';
  socket.on('data', chunk => {
    buffer += chunk.toString();
    while (buffer.includes('\r\n')) {
      const i = buffer.indexOf('\r\n'), line = buffer.slice(0, i); buffer = buffer.slice(i + 2);
      if (collecting) {
        if (line !== '.') { body.push(line.startsWith('..') ? line.slice(1) : line); continue; }
        collecting = false;
        messages.push({ recipient, raw: body.join('\r\n') }); body = [];
        if (recipient.startsWith('uncertain@')) socket.destroy();
        else setTimeout(() => socket.write('250 2.0.0 accepted\r\n'), recipient.startsWith('double@') ? 250 : 0);
      } else if (/^(EHLO|HELO)/i.test(line)) socket.write('250-localhost\r\n250-AUTH PLAIN\r\n250 SIZE 10000000\r\n');
      else if (/^AUTH PLAIN/i.test(line)) socket.write(Buffer.from(line.split(' ')[2] || '', 'base64').toString().endsWith('\0wrong') ? '535 5.7.8 invalid credentials\r\n' : '235 2.7.0 authenticated\r\n');
      else if (/^MAIL FROM:/i.test(line)) socket.write('250 OK\r\n');
      else if (/^RCPT TO:/i.test(line)) {
        recipient = line.match(/<([^>]+)>/)[1]; rcpts.set(recipient, (rcpts.get(recipient) || 0) + 1);
        if (recipient.startsWith('reject@')) socket.write('550 5.1.1 rejected\r\n');
        else if (recipient.startsWith('retry@') && rcpts.get(recipient) === 1) socket.write('451 4.7.1 try later\r\n');
        else socket.write('250 OK\r\n');
      } else if (/^DATA/i.test(line)) { collecting = true; socket.write('354 send message\r\n'); }
      else if (/^QUIT/i.test(line)) socket.end('221 goodbye\r\n');
      else socket.write('250 OK\r\n');
    }
  });
});
function launch(file, extra = {}) {
  const child = spawn(process.execPath, ['--import', 'tsx', file], { cwd: root, env: { ...runtime, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.output = '';
  child.stdout.on('data', chunk => child.output += chunk);
  child.stderr.on('data', chunk => child.output += chunk);
  processes.push(child);
  return child;
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 5000).unref())]);
}
async function waitFor(fn, label, timeout = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await fn(); if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timeout: ${label}`);
}
async function freePort() {
  const server = net.createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}
(async () => {
  try {
    const target = new URL(process.env.DATABASE_URL);
    assert(['localhost', '127.0.0.1'].includes(target.hostname), 'Tests require local PostgreSQL');
    await admin.query(`CREATE DATABASE "${database}"`); databaseCreated = true;
    execFileSync('docker', ['run', '--rm', '-d', '--name', container, '-p', '127.0.0.1::6379', 'redis:7-alpine']); redisStarted = true;
    const redisPort = execFileSync('docker', ['port', container, '6379/tcp'], { encoding: 'utf8' }).trim().split(':').pop();
    smtp.listen(0, '127.0.0.1'); await once(smtp, 'listening');
    target.pathname = '/' + database;
    runtime = { ...process.env, DATABASE_URL: target.toString(), REDIS_URL: `redis://127.0.0.1:${redisPort}/0`, PORT: String(await freePort()), SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.address().port), SMTP_SECURE: 'false', SMTP_USER: 'test', SMTP_PASSWORD: 'test', SMTP_FROM_EMAIL: 'payroll@mail.test', SMTP_FROM_NAME: 'Mail test', SMTP_MESSAGES_PER_SECOND: '100', LOG_LEVEL: 'error' };
    Object.assign(process.env, runtime);
    const migration = launch('src/scripts/migrate.ts');
    assert.equal((await once(migration, 'exit'))[0], 0, migration.output);
    db = new Pool({ connectionString: runtime.DATABASE_URL });
    const hash = await bcrypt.hash('test-password', 4);
    const roles = (await db.query('SELECT id,name FROM roles')).rows;
    const roleId = name => roles.find(role => role.name === name).id;
    const owner = (await db.query("INSERT INTO users(name,email,password_hash,role_id) VALUES ('Mail Admin','admin@mail.test',$1,$2) RETURNING id", [hash, roleId('admin')])).rows[0].id;
    await db.query("INSERT INTO users(name,email,password_hash,role_id) VALUES ('Mail Employee','employee@mail.test',$1,$2)", [hash, roleId('employee')]);
    const structure = (await db.query("INSERT INTO salary_structures(name) VALUES ('Mail fixture') RETURNING id")).rows[0].id;
    const run = (await db.query("INSERT INTO payruns(name,structure_id,start_date,end_date,status,created_by) VALUES ('Mail fixture',$1,'2026-08-01','2026-08-31','validated',$2) RETURNING id", [structure, owner])).rows[0].id;
    await db.query("INSERT INTO users(name,email,password_hash,role_id) SELECT 'Mail ' || lpad(n::text,4,'0'), 'fixture' || n || '@mail.test',$1,$2 FROM generate_series(1,505) n", [hash, roleId('employee')]);
    const line = JSON.stringify([{ ruleId: randomUUID(), name: 'Basic', code: 'BASIC', category: 'basic', sequence: 1, amount: 100 }]);
    await db.query("INSERT INTO payslips(payrun_id,employee_id,structure_id,employee_name,employee_email,structure_name,start_date,end_date,status,lines,basic,gross,net) SELECT $1,id,$2,name,email,'Mail fixture','2026-08-01','2026-08-31','validated',$3,100,100,100 FROM users WHERE email LIKE 'fixture%@mail.test'", [run, structure, line]);
    const slips = (await db.query('SELECT id FROM payslips ORDER BY employee_name')).rows.map(row => row.id);
    require('tsx/cjs');
    redisModule = require('../src/lib/redis.ts'); dbModule = require('../src/lib/db.ts');
    ({ payslipEmailQueue: queue } = require('../src/queues/payslipEmail.queue.ts'));
    const readiness = require('../src/lib/payroll-email-readiness.ts');
    const jobs = require('../src/services/payslip-email-job.service.ts');
    const repo = require('../src/repositories/payslipDelivery.repository.ts');
    await queue.waitUntilReady();
    launch('src/server.ts');
    const base = `http://127.0.0.1:${runtime.PORT}/api`;
    await waitFor(async () => { try { return (await fetch(base + '/auth/me')).status === 401; } catch { return false; } }, 'API startup');
    async function request(url, method = 'GET', body, token = access) {
      const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      return { status: res.status, body: await res.json() };
    }
    let access = '';
    access = (await request('/auth/login', 'POST', { email: 'admin@mail.test', password: 'test-password' })).body.data.accessToken;
    const employee = (await request('/auth/login', 'POST', { email: 'employee@mail.test', password: 'test-password' })).body.data.accessToken;
    const send = (index, email) => request(`/payroll/payslips/${slips[index]}/send`, 'POST', { email });
    const status = async index => (await db.query('SELECT status, attempts, error, job_id FROM payslip_deliveries WHERE payslip_id=$1', [slips[index]])).rows[0];
    assert.equal((await send(0, 'success@mail.test')).status, 503);
    assert.equal((await db.query('SELECT count(*)::int n FROM payslip_deliveries')).rows[0].n, 0);
    assert.equal((await request(`/payroll/payslips/${slips[0]}/send`, 'POST', {}, employee)).status, 403);
    console.log('PASS worker offline and role checks');
    const badWorker = launch('src/workers/payslipEmail.worker.ts', { SMTP_PASSWORD: 'wrong' });
    assert.equal((await once(badWorker, 'exit'))[0], 1, badWorker.output);
    assert.equal((await readiness.getEmailReadiness()).available, false);
    worker = launch('src/workers/payslipEmail.worker.ts');
    await waitFor(async () => (await readiness.getEmailReadiness()).available, 'worker readiness');
    assert.equal((await send(0, 'success@mail.test')).status, 202);
    await waitFor(async () => (await status(0))?.status === 'sent', 'successful delivery');
    const raw = messages.find(message => message.recipient === 'success@mail.test').raw;
    assert.match(raw, /Content-Type: application\/pdf/);
    const attachment = raw.split(/Content-Type: application\/pdf/i)[1].split('\r\n\r\n')[1].split('\r\n--')[0].replace(/\s/g, '');
    const pdf = await PDFDocument.load(Buffer.from(attachment, 'base64'));
    assert(pdf.getPageCount() >= 1);
    assert.equal((await request(`/payroll/payruns/${run}/deliveries`)).body.data.deliveries[0].status, 'sent');
    console.log('PASS SMTP delivery, readable PDF attachment, and status API');
    const doubled = await Promise.all([send(1, 'double@mail.test'), send(1, 'double@mail.test')]);
    assert.deepEqual(doubled.map(item => item.status).sort(), [202, 409]);
    await waitFor(async () => (await status(1))?.status === 'sent', 'duplicate-click delivery');
    assert.equal(messages.filter(message => message.recipient === 'double@mail.test').length, 1);
    const sentAttempt = await status(1);
    await queue.add('send-payslip', { payslipId: slips[1], payrunId: run, recipient: 'double@mail.test' }, { jobId: randomUUID() });
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.equal(messages.filter(message => message.recipient === 'double@mail.test').length, 1);
    assert.equal((await status(1)).job_id, sentAttempt.job_id);
    console.log('PASS duplicate clicks and obsolete jobs');
    assert.equal((await send(2, 'reject@mail.test')).status, 202);
    await waitFor(async () => (await status(2))?.status === 'failed', 'permanent rejection');
    assert.equal((await status(2)).attempts, 1);
    assert.equal((await send(3, 'uncertain@mail.test')).status, 202);
    await waitFor(async () => (await status(3))?.status === 'failed', 'uncertain outcome');
    assert.match((await status(3)).error, /outcome is unknown/);
    assert.equal(messages.filter(message => message.recipient === 'uncertain@mail.test').length, 1);
    assert.equal((await send(4, 'retry@mail.test')).status, 202);
    await waitFor(async () => (await status(4))?.status === 'sent', 'transient retry');
    assert.equal((await status(4)).attempts, 2);
    console.log('PASS permanent rejection, uncertain SMTP result, and transient retry');
    assert.equal((await request(`/payroll/payruns/${run}/send-payslips`, 'POST', { payslipIds: [] })).status, 400);
    assert.equal((await request(`/payroll/payruns/${run}/send-payslips`, 'POST', { payslipIds: [randomUUID()] })).status, 400);
    const selected = await request(`/payroll/payruns/${run}/send-payslips`, 'POST', { payslipIds: [slips[504]], recipients: [{ payslipId: slips[504], email: 'last@mail.test' }] });
    assert.equal(selected.status, 202);
    await waitFor(async () => (await status(504))?.status === 'sent', 'recipient beyond first page');
    await stop(worker);
    assert.equal((await readiness.getEmailReadiness()).available, false);
    // Exercise a full 505-recipient dispatch without a consumer; only this
    // isolated test publishes readiness to hold jobs for assertions.
    await readiness.publishEmailWorkerReady();
    const all = await request(`/payroll/payruns/${run}/send-payslips`, 'POST', {});
    assert.equal(all.status, 202);
    assert.equal(all.body.data.queued.length, 505);
    await queue.pause();
    await db.query("UPDATE payslip_deliveries SET queued_at=NOW()-INTERVAL '1 hour',updated_at=NOW()-INTERVAL '1 hour'");
    assert.equal(await jobs.reconcileDeliveries(), 0);
    assert.equal((await status(0)).status, 'queued');
    // A prior attempt cannot update or send on behalf of the new job.
    const current = await status(0);
    await repo.markDeliveryStatus(slips[0], 'sent', { jobId: randomUUID(), messageId: 'old' });
    assert.equal((await status(0)).status, 'queued');
    await queue.remove(current.job_id);
    assert.equal(await jobs.reconcileDeliveries(), 1);
    assert.equal((await status(0)).status, 'failed');
    await readiness.clearEmailWorkerReady();
    console.log('PASS all 505 recipients, empty/foreign selection rejection, backlog recovery, stale-attempt protection, and clean worker shutdown');
    await queue.obliterate();
    const devPort = await freePort();
    const combined = launch('scripts/dev-with-mail.cjs', { PORT: String(devPort) });
    await waitFor(async () => {
      try { return (await fetch(`http://127.0.0.1:${devPort}/api/auth/me`)).status === 401 && (await readiness.getEmailReadiness()).available; }
      catch { return false; }
    }, 'combined development startup');
    await stop(combined);
    assert.equal((await readiness.getEmailReadiness()).available, false);
    await assert.rejects(fetch(`http://127.0.0.1:${devPort}/api/auth/me`));
    console.log('PASS combined API/worker startup and coordinated shutdown');
    console.log(`PASS ${messages.length} messages captured locally; no external emails sent`);
  } finally {
    for (const child of processes) await stop(child);
    if (queue) await queue.close();
    if (redisModule) redisModule.redis.disconnect();
    if (dbModule) await dbModule.pool.end();
    if (db) await db.end();
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => smtp.close(resolve));
    if (databaseCreated) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await admin.end();
    if (redisStarted) execFileSync('docker', ['stop', container], { stdio: 'ignore' });
  }
})().catch(error => { console.error(error); for (const child of processes) if (child.output) console.error(child.output.slice(-1500)); process.exitCode = 1; });
