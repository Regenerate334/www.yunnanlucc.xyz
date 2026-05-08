/**
 * 土地流转流向分析路由 (Land Transfer Flow Routes)
 * 职责：处理地类变化转移矩阵、桑基图数据流向及相关时空变化计算。
 *
 * 修改提示：
 * 1. 转移矩阵计算时间复杂度较高，必须确保使用正确的 period_encoder 工具解析时间段。
 * 2. 返回的数据结构需要严格适配前端 ECharts 桑基图及弦图所要求的数据格式。
 * 3. 若涉及跨市州大范围查询，可能需要对数据进行聚合降采样以降低前端渲染压力。
 */
import express from 'express';
import pool from '../../config/db.js';
import { handleError } from '../../middleware/logger.js';
import {
  getAvailablePeriods,
  findOverlappingPeriods
} from '../../utils/period_encoder.js';

const router = express.Router();

const ALLOWED_TABLES = {
  county: 'spatial_county_yunnan_transfer',
  grid: 'spatial_grid_yunnan_transfer'
};

function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

function parseRequiredInt(value, field) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw httpError(400, `Invalid parameter: ${field}`);
  }
  return parsed;
}

function parseOptionalClass(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return parseRequiredInt(value, field);
}

function validateTransferRequest(query, forcedUnit = null) {
  const yearStart = parseRequiredInt(query.yearStart, 'yearStart');
  const yearEnd = parseRequiredInt(query.yearEnd, 'yearEnd');
  const fromClass = parseOptionalClass(query.fromClass, 'fromClass');
  const toClass = parseOptionalClass(query.toClass, 'toClass');
  const unit = forcedUnit || query.unit;

  if (!ALLOWED_TABLES[unit]) {
    throw httpError(400, 'Invalid parameter: unit');
  }
  if (yearStart >= yearEnd) {
    throw httpError(400, 'Invalid parameter: yearStart must be < yearEnd');
  }
  if (fromClass !== null && (fromClass < 1 || fromClass > 8)) {
    throw httpError(400, 'Invalid parameter: fromClass must be within [1, 8]');
  }
  if (toClass !== null && (toClass < 1 || toClass > 8)) {
    throw httpError(400, 'Invalid parameter: toClass must be within [1, 8]');
  }

  return {
    yearStart,
    yearEnd,
    fromClass,
    toClass,
    unit,
    region: query.region
  };
}

function buildColumnNamesByDirection(periods, fromClass, toClass) {
  const columns = [];
  const allClasses = Array.from({ length: 8 }, (_, i) => i + 1);
  for (const p of periods) {
    if (fromClass !== null && toClass !== null) {
      columns.push(`${p}_${fromClass}${toClass}`);
      continue;
    }
    if (fromClass !== null && toClass === null) {
      allClasses
        .filter((cls) => cls !== fromClass)
        .forEach((cls) => columns.push(`${p}_${fromClass}${cls}`));
      continue;
    }
    if (fromClass === null && toClass !== null) {
      allClasses
        .filter((cls) => cls !== toClass)
        .forEach((cls) => columns.push(`${p}_${cls}${toClass}`));
      continue;
    }
    allClasses.forEach((f) => {
      allClasses
        .filter((t) => t !== f)
        .forEach((t) => columns.push(`${p}_${f}${t}`));
    });
  }
  return columns;
}

function normalizeRegion(region) {
  if (typeof region !== 'string') return null;
  const trimmed = region.trim();
  if (!trimmed || trimmed === '云南省' || trimmed === '全省') return null;
  const cleaned = trimmed.replace(/[市县区自治州省]/g, '').trim();
  return cleaned || trimmed;
}

async function listAvailableDirections(tableName, periods, fromClass = null, toClass = null) {
  const cols = buildColumnNamesByDirection(periods, fromClass, toClass);
  if (!cols.length) return { from: {}, to: {} };

  const existingColsRes = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = ANY($2::text[]);
  `, [tableName, cols]);
  const existingCols = existingColsRes.rows.map((r) => r.column_name);

  const byFrom = {};
  const byTo = {};
  for (const c of existingCols) {
    const m = String(c).match(/_(\d)(\d)$/);
    if (!m) continue;
    const f = m[1];
    const t = m[2];
    if (!byFrom[f]) byFrom[f] = [];
    if (!byTo[t]) byTo[t] = [];
    if (!byFrom[f].includes(t)) byFrom[f].push(t);
    if (!byTo[t].includes(f)) byTo[t].push(f);
  }
  Object.values(byFrom).forEach((arr) => arr.sort());
  Object.values(byTo).forEach((arr) => arr.sort());

  return { from: byFrom, to: byTo, columns: existingCols };
}

export async function queryTransferGeoJSON(tableName, yearStart, yearEnd, fromClass, toClass, unit, region = null, options = {}) {
  const safeName = ALLOWED_TABLES[unit];
  if (!safeName) {
    throw httpError(400, `Invalid spatial unit: ${unit}`);
  }
  if (tableName && tableName !== safeName) {
    throw httpError(400, `Table mismatch for unit: ${unit}`);
  }

  const allPeriods = await getAvailablePeriods(pool, safeName);
  const forcedPeriods = Array.isArray(options?.periods)
    ? options.periods.map((p) => String(p)).filter(Boolean)
    : null;

  const activePeriods = forcedPeriods && forcedPeriods.length > 0
    ? forcedPeriods.filter((p) => allPeriods.includes(p))
    : findOverlappingPeriods(allPeriods, yearStart, yearEnd);

  if (activePeriods.length === 0) {
    return {
      type: 'FeatureCollection',
      features: [],
      meta: { periods: [], message: '指定年份范围内无数据' }
    };
  }

  const columns = buildColumnNamesByDirection(activePeriods, fromClass, toClass);
  const existingColsRes = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = ANY($2::text[]);
  `, [safeName, columns]);

  const existingCols = existingColsRes.rows.map((r) => r.column_name);
  if (existingCols.length === 0) {
    const available = await listAvailableDirections(safeName, activePeriods, fromClass, toClass);
    return {
      type: 'FeatureCollection',
      features: [],
      meta: {
        message: '匹配字段在数据库中不存在',
        periods: activePeriods,
        available_directions: available,
        hint: '该转移方向在当前 transfer 宽表中未建模或无字段。请更换方向，或改用“净流入(*->X)/净流出(X->*)/总流转(*->*)”口径。'
      }
    };
  }

  const sumExpr = existingCols.map((c) => `COALESCE("${c}", 0)`).join(' + ');
  const tolerance = unit === 'county' ? 0.005 : 0.001;
  const limitClause = unit === 'county' ? '' : 'ORDER BY transfer_area DESC LIMIT 2000';
  const nameField = unit === 'county'
    ? '"地名" AS name, "区划码" AS adcode,'
    : 'grid_id AS name, grid_id AS adcode,';

  const sqlParams = [];
  let regionFilter = '';
  const normalizedRegion = normalizeRegion(region);
  if (unit === 'county' && normalizedRegion) {
    sqlParams.push(`%${normalizedRegion}%`);
    const idx = sqlParams.length;
    regionFilter = ` AND ("地名" LIKE $${idx} OR "地级" LIKE $${idx})`;
  }

  const sql = `
    SELECT
      gid,
      ${nameField}
      (${sumExpr}) AS transfer_area,
      ST_AsGeoJSON(
        ST_SimplifyPreserveTopology(ST_Transform(geom, 4326), ${tolerance})
      )::json AS geometry
    FROM public."${safeName}"
    WHERE (${sumExpr}) > 0 ${regionFilter}
    ${limitClause};
  `;

  const result = await pool.query(sql, sqlParams);
  const features = result.rows.map((row) => ({
    type: 'Feature',
    id: row.gid,
    geometry: row.geometry,
    properties: {
      gid: row.gid,
      name: row.name,
      adcode: row.adcode,
      transfer_area: Number.parseFloat(row.transfer_area) || 0
    }
  }));

  return {
    type: 'FeatureCollection',
    features,
    meta: {
      yearStart,
      yearEnd,
      fromClass,
      toClass,
      periods: activePeriods,
      columns_used: existingCols,
      feature_count: features.length
    }
  };
}

function handleRouteError(res, err) {
  if (err?.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  return handleError(res, err);
}

router.get('/county', async (req, res) => {
  let params;
  try {
    params = validateTransferRequest(req.query, 'county');
  } catch (err) {
    return handleRouteError(res, err);
  }

  try {
    const geoJSON = await queryTransferGeoJSON(
      ALLOWED_TABLES.county,
      params.yearStart,
      params.yearEnd,
      params.fromClass,
      params.toClass,
      params.unit,
      params.region
    );
    res.json(geoJSON);
  } catch (err) {
    handleRouteError(res, err);
  }
});

router.get('/grid', async (req, res) => {
  let params;
  try {
    params = validateTransferRequest(req.query, 'grid');
  } catch (err) {
    return handleRouteError(res, err);
  }

  try {
    const geoJSON = await queryTransferGeoJSON(
      ALLOWED_TABLES.grid,
      params.yearStart,
      params.yearEnd,
      params.fromClass,
      params.toClass,
      params.unit,
      params.region
    );
    res.json(geoJSON);
  } catch (err) {
    handleRouteError(res, err);
  }
});

export default router;
