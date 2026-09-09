/**
 * Build a pagination payload and a WHERE clause from query params.
 * Usage: const { page, limit, offset, sort, ... } = parseQuery(req.query, {allowedSorts, defaultSort, searchCols})
 */
function parseQuery(query = {}, options = {}) {
  const {
    allowedSorts = [],
    defaultSort = 'created_at',
    defaultOrder = 'DESC',
    searchCols = [],
  } = options;

  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  let sort = defaultSort;
  if (allowedSorts.includes(query.sort)) sort = query.sort;
  // Guard against SQL injection on sort column
  if (!/^[a-zA-Z_]+$/.test(sort)) sort = defaultSort;

  const order = String(query.order || defaultOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const clauses = [];
  const params = [];
  let ps = 1;

  // search across provided text columns
  if (query.search && searchCols.length) {
    const like = `%${query.search}%`;
    const ors = searchCols.map((col) => `CAST(${col} AS text) ILIKE $${ps++}`).join(' OR ');
    clauses.push(`(${ors})`);
    searchCols.forEach(() => params.push(like));
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const pagination = { page, limit, offset, total: 0, pageCount: 0 };

  return { page, limit, offset, sort, order, where, params, pagination };
}

/** Count/pagination serializer given a `count` number. */
function makePagination(pagination, total) {
  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    pageCount: Math.ceil((total || 0) / pagination.limit),
  };
}

module.exports = { parseQuery, makePagination };