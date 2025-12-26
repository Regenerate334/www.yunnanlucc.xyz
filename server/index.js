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

// 获取省份数据（宽表格式）
app.get('/api/clcd/province', async (_req, res) => {
  try {
    // clcd_province 表结构: id, land_use_type, year, area
    // 需要转换为宽表: [{year: 1985, cropland: 123, forest: 456, ...}, ...]
    const sql = `
      SELECT year, land_use_type, area
      FROM public.clcd_province
      ORDER BY year, land_use_type
    `;
    const { rows } = await pool.query(sql);

    const yearMap = {};
    rows.forEach(row => {
      if (!yearMap[row.year]) {
        yearMap[row.year] = { year: row.year };
      }
      // land_use_type 应该是字符串，如 'cropland', 'forest'
      // 如果是数字编码，需要映射。根据截图，它是 character varying(50)，所以直接使用
      yearMap[row.year][row.land_use_type] = Number(row.area);
    });

    const result = Object.values(yearMap).sort((a, b) => a.year - b.year);
    res.json(result);
  } catch (err) { handleError(res, err); }
});

// 获取地级市数据
app.get('/api/clcd/prefecture', async (_req, res) => {
  try {
    // clcd_prefecture 表已经是宽表结构
    const sql = 'SELECT * FROM public.clcd_prefecture ORDER BY year, region_name';
    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (err) { handleError(res, err); }
});

// 获取区县数据
app.get('/api/clcd/county', async (_req, res) => {
  try {
    // clcd_county 表已经是宽表结构
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
    const sql = `
      SELECT * FROM public.clcd_transfer_matrix 
      WHERE period = $1
    `;
    const { rows } = await pool.query(sql, [period]);

    // 转换字段名以匹配前端期望 (from_class -> from, to_class -> to)
    // CLCD_CLASS_MAP 映射: 1->Cropland, etc.
    // 数据库中 from_class 已经是字符串 'cropland' 等 (根据截图)
    // 截图显示 from_class: 'cropland', to_class: 'cropland'
    // 前端 generateTransferMatrix 返回 { percentageMatrix: { from: { to: percent } } }

    // 我们需要将数据库的列表格式转换为矩阵格式
    // DB: [{from_class: 'cropland', to_class: 'forest', area: 123}, ...]

    const matrix = {};
    const landTypes = new Set();

    rows.forEach(row => {
      landTypes.add(row.from_class);
      landTypes.add(row.to_class);

      if (!matrix[row.from_class]) matrix[row.from_class] = {};
      matrix[row.from_class][row.to_class] = Number(row.area);
    });

    // 计算百分比矩阵
    const percentageMatrix = {};
    const types = Array.from(landTypes);

    types.forEach(from => {
      percentageMatrix[from] = {};
      let total = 0;
      types.forEach(to => {
        total += (matrix[from]?.[to] || 0);
      });

      types.forEach(to => {
        if (total > 0) {
          percentageMatrix[from][to] = parseFloat(((matrix[from]?.[to] || 0) / total * 100).toFixed(2));
        } else {
          percentageMatrix[from][to] = 0;
        }
      });
    });

    res.json({
      absoluteMatrix: matrix,
      percentageMatrix: percentageMatrix,
      landTypes: types,
      period: period
    });

  } catch (err) { handleError(res, err); }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});


