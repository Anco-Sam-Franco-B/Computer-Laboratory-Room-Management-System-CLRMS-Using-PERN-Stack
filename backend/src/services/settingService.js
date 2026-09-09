const { query } = require('../config/db');
const { audit } = require('../utils/auditHelper');
const AppError = require('../utils/AppError');

async function get(key, fallback = null) {
  const res = await query('SELECT value FROM system_settings WHERE key=$1', [key]);
  if (res.rowCount === 0) return fallback;
  try { return JSON.parse(res.rows[0].value); } catch (e) { return res.rows[0].value; }
}

async function listAll() {
  const res = await query('SELECT * FROM system_settings ORDER BY key');
  const out = {};
  res.rows.forEach((r) => {
    try { out[r.key] = JSON.parse(r.value); } catch (e) { out[r.key] = r.value; }
  });
  return out;
}

async function set(key, value, description, actor) {
  const payload = typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value);
  await query(
    `INSERT INTO system_settings (key, value, description, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,now())
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, description=EXCLUDED.description, updated_by=EXCLUDED.updated_by, updated_at=now()`,
    [key, payload, description || null, actor?.id || null]
  );
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'setting', action: `setting.updated`, entityType: 'system_setting', afterData: { key, value } });
}

async function setMany(settings, actor) {
  for (const [key, value] of Object.entries(settings)) {
    await set(key, value, null, actor);
  }
  return listAll();
}

module.exports = { get, listAll, set, setMany };