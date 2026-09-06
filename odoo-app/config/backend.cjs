function normalizeBackendUrl(value, { production = false } = {}) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Backend URL is missing. Run npm run connect -- production --url https://your-backend-domain');
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Backend URL must start with http:// or https://'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Use a plain HTTP(S) backend URL without credentials, query parameters or fragments.');
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const ip = host.split('.').map(Number);
  const local = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || !host.includes('.') || host.includes(':') ||
    (ip.length === 4 && ip.every(Number.isInteger) && (
      ip[0] === 0 || ip[0] === 10 || ip[0] === 127 || ip[0] >= 224 ||
      (ip[0] === 169 && ip[1] === 254) || (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31) ||
      (ip[0] === 192 && ip[1] === 168) || (ip[0] === 100 && ip[1] >= 64 && ip[1] <= 127)
    ));
  if (production && (url.protocol !== 'https:' || local)) {
    throw new Error('Production requires a public HTTPS hostname, not localhost or a private/LAN address.');
  }
  const pathname = url.pathname.replace(/\/+$/, '');
  if (pathname && !pathname.endsWith('/api')) throw new Error('Use the backend origin or its API base ending in /api, not a login/attendance route.');
  url.pathname = pathname || '/api';
  return url.toString().replace(/\/$/, '');
}

function isProductionBuild(env) {
  return env.NODE_ENV === 'production' || env.APP_ENV === 'production' ||
    (Boolean(env.EAS_BUILD_PROFILE) && env.EAS_BUILD_PROFILE !== 'development');
}

module.exports = { normalizeBackendUrl, isProductionBuild };
