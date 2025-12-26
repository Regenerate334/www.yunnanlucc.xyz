import express from 'express';
import pg from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = process.hrtime();
  const timestamp = new Date().toISOString();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // Log request
  console.log(`\n[${timestamp}] ${req.method} ${req.url} - IP: ${ip}`);
  if (Object.keys(req.query).length > 0) {
    console.log('  Query:', JSON.stringify(req.query));
  }
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('  Body:', JSON.stringify(req.body));
  }

  // Log response when finished
  res.on('finish', () => {
    const duration = process.hrtime(start);
    const ms = (duration[0] * 1000 + duration[1] / 1e6).toFixed(2);
    const status = res.statusCode;

    // Simple color coding for status (using ANSI escape codes)
    let statusColor = '\x1b[0m'; // Reset
    if (status >= 500) statusColor = '\x1b[31m'; // Red
    else if (status >= 400) statusColor = '\x1b[33m'; // Yellow
    else if (status >= 200) statusColor = '\x1b[32m'; // Green

    console.log(`  Response: ${statusColor}${status}\x1b[0m | Duration: ${ms}ms`);
  });

  next();
});

const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'password',
  database: process.env.PGDATABASE || 'yunnan_CLCD',
  max: 10
});

// Test DB connection and log status
pool.connect((err, client, release) => {
  if (err) {
    console.error('\x1b[31m[db] connection error:\x1b[0m', err.stack);
  } else {
    console.log('\x1b[32m[db] connected successfully\x1b[0m to', {
      host: process.env.PGHOST || 'localhost',
      database: process.env.PGDATABASE || 'yunnan_CLCD'
    });
    release();
  }
});

function handleError(res, err) {
  console.error(err);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({ error: isProd ? 'Internal server error' : String(err?.message || err) });
}

// 健康检查
app.get('/health', async (_req, res) => {
  try {
    const r = await pool.query('SELECT 1 as ok');
    res.json({ ok: true, db: r.rows[0].ok === 1 });
  } catch (err) { handleError(res, err); }
});

// 调试：检查合并表是否可访问与行数
app.get('/debug/table', async (_req, res) => {
  try {
    const r = await pool.query('SELECT count(*)::int AS n FROM public.yunnan_clcd_merged_table');
    res.json({ exists: true, rows: r.rows[0].n });
  } catch (err) { handleError(res, err); }
});

// 获取年份列表（来自合并表）
app.get('/api/years', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT DISTINCT year FROM public.yunnan_clcd_merged_table ORDER BY year');
    res.json(rows.map(r => r.year));
  } catch (err) { handleError(res, err); }
});

// landuse_type 数值编码到名称映射
const CLCD_CLASS_MAP = {
  1: 'Cropland',
  2: 'Forest',
  3: 'Shrub',
  4: 'Grassland',
  5: 'Water',
  6: 'Snow/Ice',
  7: 'Barren',
  8: 'Impervious',
  9: 'Wetland'
};

// 获取某年份各地类面积统计（km²）
app.get('/api/clcd/:year/summary', async (req, res) => {
  const year = Number(req.params.year);
  if (!Number.isInteger(year)) return res.status(400).json({ error: 'Invalid year' });
  try {
    const sql = `
      SELECT landuse_type, SUM(area_sqm) / 1e6 AS area_km2
      FROM public.yunnan_clcd_merged_table
      WHERE year = $1
      GROUP BY landuse_type
      ORDER BY landuse_type
    `;
    const { rows } = await pool.query(sql, [year]);
    const mapped = rows.map(r => ({
      class_code: Number(r.landuse_type),
      class_name: CLCD_CLASS_MAP[Number(r.landuse_type)] || String(r.landuse_type),
      area_km2: Number(r.area_km2)
    }));
    res.json(mapped);
  } catch (err) { handleError(res, err); }
});

// 获取年度总面积堆叠序列
app.get('/api/clcd/series', async (req, res) => {
  try {
    const level = (req.query.level || 'province').toString();
    const code = (req.query.code || 'yunnan').toString();
    const start = Number(req.query.start || 1990);
    const end = Number(req.query.end || 2023);
    let where = '';
    const params = [];
    if (level === 'prefecture') { where = 'WHERE prefecture = $1'; params.push(code); }
    if (level === 'county') { where = 'WHERE county = $1'; params.push(code); }
    const yearClause = `${where ? ' AND' : ' WHERE'} year BETWEEN $${params.length + 1} AND $${params.length + 2}`;
    params.push(start, end);
    const sql = `
      SELECT year, landuse_type, SUM(area_sqm)/1e6 AS area_km2
      FROM public.yunnan_clcd_merged_table
      ${where}${yearClause}
      GROUP BY year, landuse_type
      ORDER BY year, landuse_type
    `;
    const { rows } = await pool.query(sql, params);
    const mapped = rows.map(r => ({
      year: Number(r.year),
      class_code: Number(r.landuse_type),
      class_name: CLCD_CLASS_MAP[Number(r.landuse_type)] || String(r.landuse_type),
      area_km2: Number(r.area_km2)
    }));
    res.json(mapped);
  } catch (err) { handleError(res, err); }
});

// 获取省份数据（宽表格式）
app.get('/api/clcd/province', async (_req, res) => {
  try {
    const sql = `
      SELECT year, land_use_type, area
      FROM public.clcd_province
      ORDER BY year, land_use_type
    `;
    const { rows } = await pool.query(sql);
    const yearMap = {};
    rows.forEach(row => {
      if (!yearMap[row.year]) yearMap[row.year] = { year: row.year };
      yearMap[row.year][row.land_use_type] = Number(row.area);
    });
    const result = Object.values(yearMap).sort((a, b) => a.year - b.year);
    res.json(result);
  } catch (err) { handleError(res, err); }
});

// 获取特定区域（州市或区县）的历年趋势数据
app.get('/api/clcd/trend/:level/:name', async (req, res) => {
  const { level, name } = req.params;
  try {
    console.log(`[api] Fetching trend for ${level}: ${name}`);
    const tableName = level === 'prefecture' ? 'public.clcd_prefecture' : 'public.clcd_county';
    const sql = `SELECT * FROM ${tableName} WHERE TRIM(region_name) = $1 ORDER BY year ASC`;
    const { rows } = await pool.query(sql, [name.trim()]);

    if (rows.length === 0) {
      console.log(`[api] No data found for ${name}`);
      return res.json([]);
    }

    const result = rows.map(row => ({
      year: row.year,
      cropland: Number(row.cropland),
      forest: Number(row.forest),
      shrub: Number(row.shrub),
      grassland: Number(row.grassland),
      water: Number(row.water),
      snow_ice: Number(row.snow_ice),
      barren: Number(row.barren),
      impervious: Number(row.impervious),
      wetland: Number(row.wetland)
    }));
    res.json(result);
  } catch (err) { handleError(res, err); }
});

// 获取所有区域名称列表
app.get('/api/regions/:level', async (req, res) => {
  const { level } = req.params;
  try {
    const tableName = level === 'prefecture' ? 'public.clcd_prefecture' : 'public.clcd_county';
    const sql = `SELECT DISTINCT region_name FROM ${tableName} ORDER BY region_name ASC`;
    const { rows } = await pool.query(sql);
    res.json(rows.map(r => r.region_name));
  } catch (err) { handleError(res, err); }
});

// 获取地级市数据
app.get('/api/clcd/prefecture', async (_req, res) => {
  try {
    const sql = 'SELECT * FROM public.clcd_prefecture ORDER BY year, region_name';
    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (err) { handleError(res, err); }
});

// 获取区县数据
app.get('/api/clcd/county', async (_req, res) => {
  try {
    const sql = 'SELECT * FROM public.clcd_county ORDER BY year, region_name';
    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (err) { handleError(res, err); }
});

// 获取转移矩阵可用时间段
app.get('/api/clcd/transfer-matrix/periods', async (_req, res) => {
  try {
    const sql = 'SELECT DISTINCT period FROM public.clcd_transfer_matrix ORDER BY period';
    const { rows } = await pool.query(sql);
    res.json(rows.map(r => r.period));
  } catch (err) { handleError(res, err); }
});

// 获取指定时间段的转移矩阵
app.get('/api/clcd/transfer-matrix/:period', async (req, res) => {
  const { period } = req.params;
  try {
    const sql = `SELECT * FROM public.clcd_transfer_matrix WHERE period = $1`;
    const { rows } = await pool.query(sql, [period]);
    const matrix = {};
    const landTypes = new Set();
    rows.forEach(row => {
      landTypes.add(row.from_class);
      landTypes.add(row.to_class);
      if (!matrix[row.from_class]) matrix[row.from_class] = {};
      matrix[row.from_class][row.to_class] = Number(row.area);
    });
    const percentageMatrix = {};
    const types = Array.from(landTypes);
    types.forEach(from => {
      percentageMatrix[from] = {};
      let total = 0;
      types.forEach(to => { total += (matrix[from]?.[to] || 0); });
      types.forEach(to => {
        percentageMatrix[from][to] = total > 0 ? parseFloat(((matrix[from]?.[to] || 0) / total * 100).toFixed(2)) : 0;
      });
    });
    res.json({ absoluteMatrix: matrix, percentageMatrix, landTypes: types, period });
  } catch (err) { handleError(res, err); }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
