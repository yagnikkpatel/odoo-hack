const { normalizeBackendUrl, isProductionBuild } = require('./config/backend.cjs');
const backend = require('./backend.config.json');

module.exports = ({ config }) => {
  const production = isProductionBuild(process.env);
  const raw = production
    ? process.env.APP_PRODUCTION_API_URL || backend.productionUrl || process.env.EXPO_PUBLIC_API_URL
    : process.env.EXPO_PUBLIC_API_URL;
  // Native release builds/exports must never silently ship a development IP.
  const apiUrl = raw || production ? normalizeBackendUrl(raw, { production }) : null;
  return { ...config, extra: { ...config.extra, apiUrl } };
};
