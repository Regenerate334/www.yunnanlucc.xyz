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

router.get('/transfer-series', async (req, res) => {
  const { unit, region } = req.query;

  let yearStartNum;
  let yearEndNum;
  let fromClassNum;
  let toClassNum;

  try {
    yearStartNum = parseRequiredInt(req.query.yearStart, 'yearStart');
    yearEndNum = parseRequiredInt(req.query.yearEnd, 'yearEnd');
    fromClassNum = parseRequiredInt(req.query.fromClass, 'fromClass');
    toClassNum = parseRequiredInt(req.query.toClass, 'toClass');
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  if (!TABLE_BY_UNIT[unit]) {
    return res.status(400).json({ error: 'Invalid parameter: unit' });
  }
  if (yearStartNum > yearEndNum) {
    return res.status(400).json({ error: 'Invalid parameter: yearStart must be <= yearEnd' });
  }
  if (fromClassNum < 1 || fromClassNum > 9 || toClassNum < 1 || toClassNum > 9) {
    return res.status(400).json({ error: 'Invalid parameter: class code must be within [1, 9]' });
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
        region
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
      const meanCenter = turf.centerOfMass(pointCollection, { weight: 'weight' });
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

