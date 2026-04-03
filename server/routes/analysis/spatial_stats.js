import express from 'express';
import { handleError } from '../../middleware/logger.js';
import { queryTransferGeoJSON } from './transfer_flow.js';
import * as turf from '@turf/turf';
import pool from '../../config/db.js';
import { getAvailablePeriods, findOverlappingPeriods, sortPeriods, decodePeriod } from '../../utils/period_encoder.js';

const router = express.Router();

/**
 * 获取时序流转空间的 标准差椭圆 与 重心轨迹
 * 请求: GET /api/analysis/spatial-stats/transfer-series?yearStart=1985&yearEnd=2020&fromClass=1&toClass=2&unit=county
 */
router.get('/transfer-series', async (req, res) => {
    const { yearStart, yearEnd, fromClass, toClass, unit } = req.query;

    if (!yearStart || !yearEnd || !fromClass || !toClass || !unit) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const tableName = unit === 'county' ? 'spatial_county_yunnan_transfer' : 'spatial_grid_yunnan_transfer';

        // 1. 获取该范围内的所有期间列表
        const allPeriodsStr = await getAvailablePeriods(pool, tableName);
        let activePeriods = findOverlappingPeriods(allPeriodsStr, parseInt(yearStart), parseInt(yearEnd));

        // 确保 period 严格按年份排序 (解决 y0001 < y8590 的问题)
        activePeriods = sortPeriods(activePeriods);

        if (activePeriods.length === 0) {
            return res.json({ type: 'FeatureCollection', features: [], message: 'No periods found' });
        }

        const features = [];
        const centersByPeriod = new Map(); // 用于后续构建轨迹

        // 2. 针对每一个 period 独立计算
        for (const period of activePeriods) {
            const [pStart, pEnd] = decodePeriod(period);

            // 查询单个时间段的数据
            const geoJSON = await queryTransferGeoJSON(
                tableName, pStart, pEnd,
                parseInt(fromClass), parseInt(toClass),
                unit
            );

            if (!geoJSON.features || geoJSON.features.length === 0) {
                continue;
            }

            // 提取质心并赋权重
            const points = [];
            geoJSON.features.forEach(f => {
                if (f.properties.transfer_area > 0) {
                    const center = turf.centroid(f);
                    center.properties = { weight: f.properties.transfer_area };
                    points.push(center);
                }
            });

            if (points.length < 3) {
                // 如果点太少无法生成椭圆，但至少能生成重心
                if (points.length > 0) {
                    const pointCollection = turf.featureCollection(points);
                    const meanCenter = turf.centerOfMass(pointCollection, { weight: 'weight' });
                    meanCenter.properties = {
                        type: 'center', period, yearStart: pStart, yearEnd: pEnd, fromClass, toClass
                    };
                    features.push(meanCenter);
                    centersByPeriod.set(period, meanCenter);
                }
                continue;
            }

            const pointCollection = turf.featureCollection(points);

            // 计算椭圆和重心
            const sde = turf.standardDeviationalEllipse(pointCollection, { weight: 'weight', steps: 64 });
            const meanCenter = turf.centerOfMass(pointCollection, { weight: 'weight' });

            // 补充标识属性
            sde.properties = {
                type: 'sde', period, yearStart: pStart, yearEnd: pEnd, fromClass, toClass
            };
            meanCenter.properties = {
                type: 'center', period, yearStart: pStart, yearEnd: pEnd, fromClass, toClass
            };

            features.push(sde);
            features.push(meanCenter);
            centersByPeriod.set(period, meanCenter);
        }

        // 3. 构建迁移轨迹线 (确保按 activePeriods 顺序连接)
        const trajectoryCoords = [];
        for (const p of activePeriods) {
            const c = centersByPeriod.get(p);
            if (c) trajectoryCoords.push(c.geometry.coordinates);
        }

        if (trajectoryCoords.length >= 2) {
            const trajectory = turf.lineString(trajectoryCoords, {
                type: 'trajectory', yearStart, yearEnd, fromClass, toClass
            });
            features.push(trajectory);
        }

        res.json({
            type: 'FeatureCollection',
            features,
            meta: { yearStart, yearEnd, fromClass, toClass, periods: activePeriods }
        });

    } catch (err) {
        handleError(res, err);
    }
});

export default router;
