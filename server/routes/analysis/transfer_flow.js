import express from 'express';
import pool from '../../config/db.js';
import { handleError } from '../../middleware/logger.js';
import {
  getAvailablePeriods,
  findOverlappingPeriods,
  buildColumnNames
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

function validateTransferRequest(query, forcedUnit = null) {
  const yearStart = parseRequiredInt(query.yearStart, 'yearStart');
  const yearEnd = parseRequiredInt(query.yearEnd, 'yearEnd');
  const fromClass = parseRequiredInt(query.fromClass, 'fromClass');
  const toClass = parseRequiredInt(query.toClass, 'toClass');
  const unit = forcedUnit || query.unit;

  if (!ALLOWED_TABLES[unit]) {
    throw httpError(400, 'Invalid parameter: unit');
  }
  if (yearStart > yearEnd) {
    throw httpError(400, 'Invalid parameter: yearStart must be <= yearEnd');
  }
  if (fromClass < 1 || fromClass > 9 || toClass < 1 || toClass > 9) {
    throw httpError(400, 'Invalid parameter: class code must be within [1, 9]');
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

function normalizeRegion(region) {
  if (typeof region !== 'string') return null;
  const trimmed = region.trim();
  if (!trimmed || trimmed === '云南省' || trimmed === '全省') return null;
  const cleaned = trimmed.replace(/[市县区自治州省]/g, '').trim();
  return cleaned || trimmed;
}

export async function queryTransferGeoJSON(tableName, yearStart, yearEnd, fromClass, toClass, unit, region = null) {
  const safeName = ALLOWED_TABLES[unit];
  if (!safeName) {
    throw httpError(400, `Invalid spatial unit: ${unit}`);
  }
  if (tableName && tableName !== safeName) {
    throw httpError(400, `Table mismatch for unit: ${unit}`);
  }

  const allPeriods = await getAvailablePeriods(pool, safeName);
  const activePeriods = findOverlappingPeriods(allPeriods, yearStart, yearEnd);

  if (activePeriods.length === 0) {
    return {
      type: 'FeatureCollection',
      features: [],
      meta: { periods: [], message: '指定年份范围内无数据' }
    };
  }

  const columns = buildColumnNames(activePeriods, fromClass, toClass);
  const existingColsRes = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = ANY($2::text[]);
  `, [safeName, columns]);

  const existingCols = existingColsRes.rows.map((r) => r.column_name);
  if (existingCols.length === 0) {
    return {
      type: 'FeatureCollection',
      features: [],
      meta: { message: '匹配字段在数据库中不存在' }
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

