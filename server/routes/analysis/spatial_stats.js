import express from 'express';
import * as turf from '@turf/turf';
import pool from '../../config/db.js';
import { handleError } from '../../middleware/logger.js';
import { queryTransferGeoJSON } from './transfer_flow.js';
import {
  getAvailablePeriods,
  findOverlappingPeriods,
  sortPeriods,
  decodePeriod
} from '../../utils/period_encoder.js';

const router = express.Router();

const TABLE_BY_UNIT = {
  county: 'spatial_county_yunnan_transfer',
  grid: 'spatial_grid_yunnan_transfer'
};

function parseRequiredInt(value, field) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    const err = new Error(`Invalid parameter: ${field}`);
    err.statusCode = 400;
    throw err;
  }
  return parsed;
}

function parseOptionalClass(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return parseRequiredInt(value, field);
}

router.get('/transfer-series', async (req, res) => {
  const { unit, region } = req.query;

  let yearStartNum;
  let yearEndNum;
  let fromClassNum;
  let toClassNum;

  try {
    yearStartNum = parseRequiredInt(req.query.yearStart, 'yearStart');
    yearEndNum = parseRequiredInt(req.query.yearEnd, 'yearEnd');
    fromClassNum = parseOptionalClass(req.query.fromClass, 'fromClass');
    toClassNum = parseOptionalClass(req.query.toClass, 'toClass');
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  if (!TABLE_BY_UNIT[unit]) {
    return res.status(400).json({ error: 'Invalid parameter: unit' });
  }
  if (yearStartNum >= yearEndNum) {
    return res.status(400).json({ error: 'Invalid parameter: yearStart must be < yearEnd' });
  }
  if (fromClassNum !== null && (fromClassNum < 1 || fromClassNum > 8)) {
    return res.status(400).json({ error: 'Invalid parameter: fromClass must be within [1, 8]' });
  }
  if (toClassNum !== null && (toClassNum < 1 || toClassNum > 8)) {
    return res.status(400).json({ error: 'Invalid parameter: toClass must be within [1, 8]' });
  }

  try {
    const tableName = TABLE_BY_UNIT[unit];
    const allPeriods = await getAvailablePeriods(pool, tableName);
    const activePeriods = sortPeriods(findOverlappingPeriods(allPeriods, yearStartNum, yearEndNum));

    if (activePeriods.length === 0) {
      return res.json({
        type: 'FeatureCollection',
        features: [],
        meta: {
          yearStart: yearStartNum,
          yearEnd: yearEndNum,
          fromClass: fromClassNum,
          toClass: toClassNum,
          periods: [],
          message: '指定年份范围内无可用 period'
        }
      });
    }

    const features = [];
    const centersByPeriod = new Map();

    for (const period of activePeriods) {
      const [pStart, pEnd] = decodePeriod(period);

      const geoJSON = await queryTransferGeoJSON(
        tableName,
        pStart,
        pEnd,
        fromClassNum,
        toClassNum,
        unit,
        region,
        { periods: [period] }
      );

      if (!geoJSON.features || geoJSON.features.length === 0) {
        continue;
      }

      const points = [];
      for (const feature of geoJSON.features) {
        if ((feature?.properties?.transfer_area || 0) <= 0) continue;
        try {
          const center = turf.centroid(feature);
          center.properties = { weight: feature.properties.transfer_area };
          points.push(center);
        } catch (_err) {
          // Skip malformed feature geometry
        }
      }

      if (points.length === 0) continue;

      const pointCollection = turf.featureCollection(points);
      // 重心迁移应与标准差椭圆同源：采用加权均值中心（weight=transfer_area）
      // centerOfMass 不支持权重参数，会导致多期重心退化为同一点。
      const meanCenter = turf.centerMean(pointCollection, { weight: 'weight' });
      meanCenter.properties = {
        type: 'center',
        period,
        yearStart: pStart,
        yearEnd: pEnd,
        fromClass: fromClassNum,
        toClass: toClassNum
      };

      if (points.length >= 3) {
        const sde = turf.standardDeviationalEllipse(pointCollection, { weight: 'weight', steps: 64 });
        sde.properties = {
          type: 'sde',
          period,
          yearStart: pStart,
          yearEnd: pEnd,
          fromClass: fromClassNum,
          toClass: toClassNum
        };
        features.push(sde);
      }

      features.push(meanCenter);
      centersByPeriod.set(period, meanCenter);
    }

    const trajectoryCoords = [];
    for (const period of activePeriods) {
      const center = centersByPeriod.get(period);
      if (center?.geometry?.coordinates) {
        trajectoryCoords.push(center.geometry.coordinates);
      }
    }

    if (trajectoryCoords.length >= 2) {
      const trajectory = turf.lineString(trajectoryCoords, {
        type: 'trajectory',
        yearStart: yearStartNum,
        yearEnd: yearEndNum,
        fromClass: fromClassNum,
        toClass: toClassNum
      });
      features.push(trajectory);
    }

    res.json({
      type: 'FeatureCollection',
      features,
      meta: {
        yearStart: yearStartNum,
        yearEnd: yearEndNum,
        fromClass: fromClassNum,
        toClass: toClassNum,
        periods: activePeriods
      }
    });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
