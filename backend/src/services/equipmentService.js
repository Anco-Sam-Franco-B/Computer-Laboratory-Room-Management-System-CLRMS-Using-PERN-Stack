const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { parseQuery, makePagination } = require('../utils/pagination');
const { audit } = require('../utils/auditHelper');

async function listEquipment({ page, limit, offset, sort, order, where, params }) {
  const base = `FROM equipment e
    LEFT JOIN laboratories l ON l.id = e.laboratory_id
    WHERE e.deleted_at IS NULL`;
  const count = await query(`SELECT count(*) ${base} ${where}`, params);
  const data = await query(
    `SELECT e.*, l.name AS laboratory_name, l.code AS laboratory_code
     ${base}
     ${where}
     ORDER BY ${sort} ${order}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { rows: data.rows, pagination: makePagination({ page, limit }, parseInt(count.rows[0].count, 10)) };
}

async function getEquipment(id) {
  const res = await query(
    `SELECT e.*, l.name AS laboratory_name
     FROM equipment e LEFT JOIN laboratories l ON l.id=e.laboratory_id
     WHERE e.id=$1 AND e.deleted_at IS NULL`,
    [id]
  );
  if (res.rowCount === 0) throw new AppError('Equipment not found.', 404);
  return res.rows[0];
}

async function createEquipment(data, actor) {
  try {
    const res = await query(
      `INSERT INTO equipment (equipment_type, name, brand, model, serial_number, status, laboratory_id, assigned_to, purchase_date, warranty_until, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [data.equipmentType, data.name, data.brand || null, data.model || null, data.serialNumber || null,
       data.status || 'active', data.laboratoryId || null, data.assignedTo || null,
       data.purchaseDate || null, data.warrantyUntil || null, data.notes || null]
    );
    await audit({
      actorId: actor?.id, actorEmail: actor?.email, category: 'equipment',
      action: 'equipment.created', entityType: 'equipment', entityId: res.rows[0].id, afterData: res.rows[0],
    });
    return res.rows[0];
  } catch (err) {
    if (err.code === '23505') throw new AppError('A device with that serial number already exists.', 409);
    throw err;
  }
}

async function updateEquipment(id, data, actor) {
  const existing = await getEquipment(id);
  const fields = []; const params = []; let ps = 1;
  const map = {
    equipmentType: 'equipment_type', name: 'name', brand: 'brand', model: 'model',
    serialNumber: 'serial_number', status: 'status', laboratoryId: 'laboratory_id',
    assignedTo: 'assigned_to', purchaseDate: 'purchase_date', warrantyUntil: 'warranty_until', notes: 'notes',
  };
  for (const [k, col] of Object.entries(map)) {
    if (data[k] !== undefined) { fields.push(`${col}=$${ps++}`); params.push(data[k]); }
  }
  if (!fields.length) return existing;
  params.push(id);
  const res = await query(`UPDATE equipment SET ${fields.join(', ')}, updated_at=now() WHERE id=$${ps} RETURNING *`, params);
  await audit({
    actorId: actor?.id, actorEmail: actor?.email, category: 'equipment',
    action: 'equipment.updated', entityType: 'equipment', entityId: id, beforeData: existing, afterData: res.rows[0],
  });
  return res.rows[0];
}

/** Transfer equipment between labs (records transfer, updates lab). */
async function transferEquipment(id, { toLabId, reason }, actor) {
  const existing = await getEquipment(id);
  if (!toLabId) throw new AppError('Destination laboratory required.', 400);
  const dest = await query('SELECT id FROM laboratories WHERE id=$1 AND deleted_at IS NULL', [toLabId]);
  if (dest.rowCount === 0) throw new AppError('Destination laboratory not found.', 404);

  const result = await withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE equipment SET laboratory_id=$1, updated_at=now() WHERE id=$2 RETURNING *`,
      [toLabId, id]
    );
    await client.query(
      `INSERT INTO equipment_transfers (equipment_id, from_lab_id, to_lab_id, transferred_by, reason)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, existing.laboratory_id || null, toLabId, actor?.id, reason || null]
    );
    return updated.rows[0];
  });
  await audit({
    actorId: actor?.id, actorEmail: actor?.email, category: 'equipment',
    action: 'equipment.transferred', entityType: 'equipment', entityId: id,
    beforeData: { laboratory_id: existing.laboratory_id }, afterData: { laboratory_id: toLabId }, metadata: { reason },
  });
  return result;
}

async function listTransfers(id) {
  const res = await query(
    `SELECT t.*, fl.name AS from_lab, tl.name AS to_lab, u.first_name || ' ' || u.last_name AS transferred_by_name
     FROM equipment_transfers t
     LEFT JOIN laboratories fl ON fl.id=t.from_lab_id
     LEFT JOIN laboratories tl ON tl.id=t.to_lab_id
     LEFT JOIN users u ON u.id=t.transferred_by
     WHERE t.equipment_id=$1 ORDER BY t.transferred_at DESC`,
    [id]
  );
  return res.rows;
}

async function deleteEquipment(id, actor) {
  await getEquipment(id);
  await query('UPDATE equipment SET deleted_at=now(), updated_at=now() WHERE id=$1', [id]);
  await audit({ actorId: actor?.id, actorEmail: actor?.email, category: 'equipment', action: 'equipment.deleted', entityType: 'equipment', entityId: id });
  return { id };
}

module.exports = { listEquipment, getEquipment, createEquipment, updateEquipment, transferEquipment, listTransfers, deleteEquipment };