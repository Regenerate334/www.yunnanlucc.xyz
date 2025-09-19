import express from 'express';
import pg from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'password',
  database: process.env.PGDATABASE || 'yunnan_CLCD',
  max: 10
});

console.log('[db] connect =>', {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  database: process.env.PGDATABASE || 'yunnan_CLCD'
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
    // landuse_type: 假设为数值编码，前端映射到名称；area_sqm -> km²
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

// 获取年度总面积堆叠序列：返回 years x classes 的矩阵
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
    console.time(`[series] ${level}:${code} ${start}-${end}`);
    const { rows } = await pool.query(sql, params);
    console.timeEnd(`[series] ${level}:${code} ${start}-${end}`);
    const mapped = rows.map(r => ({
      year: Number(r.year),
      class_code: Number(r.landuse_type),
      class_name: CLCD_CLASS_MAP[Number(r.landuse_type)] || String(r.landuse_type),
      area_km2: Number(r.area_km2)
    }));
    res.json(mapped);
  } catch (err) { handleError(res, err); }
});

// 可选：按州市统计
app.get('/api/clcd/:year/prefecture-summary', async (req, res) => {
  const year = Number(req.params.year);
  try {
    const sql = `
      SELECT prefecture, landuse_type, SUM(area_sqm)/1e6 AS area_km2
      FROM public.yunnan_clcd_merged_table
      WHERE year = $1
      GROUP BY prefecture, landuse_type
      ORDER BY prefecture, landuse_type
    `;
    const { rows } = await pool.query(sql, [year]);
    const mapped = rows.map(r => ({
      prefecture: r.prefecture,
      class_code: Number(r.landuse_type),
      class_name: CLCD_CLASS_MAP[Number(r.landuse_type)] || String(r.landuse_type),
      area_km2: Number(r.area_km2)
    }));
    res.json(mapped);
  } catch (err) { handleError(res, err); }
});

// 新增：按县统计
app.get('/api/clcd/:year/county-summary', async (req, res) => {
  const year = Number(req.params.year);
  try {
    const sql = `
      SELECT county, landuse_type, SUM(area_sqm)/1e6 AS area_km2
      FROM public.yunnan_clcd_merged_table
      WHERE year = $1
      GROUP BY county, landuse_type
      ORDER BY county, landuse_type
    `;
    const { rows } = await pool.query(sql, [year]);
    const mapped = rows.map(r => ({
      county: r.county,
      class_code: Number(r.landuse_type),
      class_name: CLCD_CLASS_MAP[Number(r.landuse_type)] || String(r.landuse_type),
      area_km2: Number(r.area_km2)
    }));
    res.json(mapped);
  } catch (err) { handleError(res, err); }
});

const port = Number(process.env.PORT || 5174);
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});


