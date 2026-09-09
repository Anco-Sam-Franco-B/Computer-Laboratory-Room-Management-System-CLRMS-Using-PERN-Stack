const { query } = require('../config/db');
const AppError = require('../utils/AppError');
const { parseQuery, makePagination } = require('../utils/pagination');
const { audit } = require('../utils/auditHelper');

async function listComputers({ page, limit, offset, sort, order, where, params }) {
  const base = `FROM computers c
    LEFT JOIN laboratories l ON l.id = c.laboratory_id
    WHERE c.deleted_at IS NULL`;
  const count = await query(`SELECT count(*) ${base} ${where}`, params);
  const data = await query(
    `SELECT c.*, l.name AS laboratory_name, l.code AS laboratory_code
     ${base}
     ${where}
     ORDER BY ${sort} ${order}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { rows: data.rows, pagination: makePagination({ page, limit }, parseInt(count.rows[0].count, 10)) };
}

async function getComputer(id) {
  const res = await query(
    `SELECT c.*, l.name AS laboratory_name, l.code AS laboratory_code
     FROM computers c LEFT JOIN laboratories l ON l.id=c.laboratory_id
     WHERE c.id=$1 AND c.deleted_at IS NULL`,
    [id]
  );
  if (res.rowCount === 0) throw new AppError('Computer not found.', 404);
  return res.rows[0];
}

async function createComputer(data, actor) {
  try {
    const res = await query(
      `INSERT INTO computers (computer_number, serial_number, brand, model, processor, ram_gb, storage_gb, storage_type, os, status, laboratory_id, health_score, mac_address, purchase_date, warranty_until)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [data.computerNumber, data.serialNumber || null, data.brand || null, data.model || null,
       data.processor || null, data.ramGb || null, data.storageGb || null, data.storageType || 'SSD',
       data.os || 'Windows 11', data.status || 'active', data.laboratoryId || null,
       data.healthScore ?? 100, data.macAddress || null, data.purchaseDate || null, data.warrantyUntil || null]
    );
    await audit({
      actorId: actor?.id, actorEmail: actor?.email, category: 'computer',
      action: 'computer.created', entityType: 'computer', entityId: res.rows[0].id, afterData: res.rows[0],
    });
    return res.rows[0];
  } catch (err) {
    if (err.code === '23505') throw new AppError('A computer with that number or serial already exists.', 409);
    throw err;
  }
}

async function updateComputer(id, data, actor) {
  const existing = await getComputer(id);
  const fields = []; const params = []; let ps = 1;
  const map = {
    computerNumber: 'computer_number', serialNumber: 'serial_number', brand: 'brand', model: 'model',
    processor: 'processor', ramGb: 'ram_gb', storageGb: 'storage_gb', storageType: 'storage_type',
    os: 'os', status: 'status', laboratoryId: 'laboratory_id', healthScore: 'health_score',
    macAddress: 'mac_address', purchaseDate: 'purchase_date', warrantyUntil: 'warranty_until',
  };
  for (const [k, col] of Object.entries(map)) {
    if (data[k] !== undefined) { fields.push(`${col}=$${ps++}`); params.push(data[k]); }
  }
  if (!fields.length) return existing;
  params.push(id);
  const res = await query(`UPDATE computers SET ${fields.join(', ')}, updated_at=now() WHERE id=$${ps} RETURNING *`, params);
  await audit({
    actorId: actor?.id, actorEmail: actor?.email, category: 'computer',
    action: 'computer.updated', entityType: 'computer', entityId: id, beforeData: existing, afterData: res.rows[0],
  });
  return res.rows[0];
}

async function assignToLab(id, labId, actor) {
  return updateComputer(id, { laboratoryId: labId }, actor);
}

async function updateHealth(id, healthScore, actor) {
  if (healthScore < 0 || healthScore > 100) throw new AppError('Health score must be 0-100.', 400);
  return updateComputer(id, { healthScore }, actor);
}

async function deleteComputer(id, actor) {
  await getComputer(id);
  await query('UPDATE computers SET deleted_at=now(), updated_at=now() WHERE id=$1', [id]);
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'computer', action: 'computer.deleted', entityType: 'computer', entityId: id });
  return { id };
}

/** Health distribution + stats for inventory dashboards. */
async function stats() {
  const r = await query(
    `SELECT
       (SELECT count(*) FROM computers WHERE deleted_at IS NULL) AS total,
       (SELECT count(*) FROM computers WHERE status='active' AND deleted_at IS NULL) AS active,
       (SELECT count(*) FROM computers WHERE status='maintenance' AND deleted_at IS NULL) AS maintenance,
       (SELECT count(*) FROM computers WHERE status='broken' AND deleted_at IS NULL) AS broken,
       (SELECT count(*) FROM computers WHERE status='retired' AND deleted_at IS NULL) AS retired,
       (SELECT COALESCE(round(avg(health_score)),0)::int FROM computers WHERE deleted_at IS NULL) AS avg_health`
  );
  return r.rows[0];
}

module.exports = { listComputers, getComputer, createComputer, updateComputer, assignToLab, updateHealth, deleteComputer, stats };