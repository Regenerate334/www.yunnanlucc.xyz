/**
 * Agent 专用执行工具 (Agent Dedicated Tool Executor)
 * 职责：作为 Agent 动作节点，提供针对 spatialStatsTool 维度的真实数据获取及格式化封装。
 *
 * 修改提示：
 * 1. 返回值需最大程度扁平化和自然语言化，便于大模型理解和吸收。
 * 2. 若涉及异步操作，请务必处理 Promise 的 catch 块防止未捕获异常。
 * 3. 遵循现有的 ESLint 和团队代码规范，保持极简及高可读性。
 */
import pool from '../../config/db.js';
import { queryTransferGeoJSON } from '../../routes/analysis/transfer_flow.js';
import registry from '../dataSourceRegistry.js';
import logger from '../../config/logger.js';
import * as turf from '@turf/turf';
import { getAvailablePeriods, findOverlappingPeriods, sortPeriods, decodePeriod } from '../period_encoder.js';

// 地类编码 → 中文名称
const LAND_CLASS_NAMES = {
    // transfer 宽表 8 类编码（灌木并入林地）：
    // 1耕地 2林地(含灌木) 3草地 4水体 5冰雪 6裸地 7建设用地 8湿地
    1: '耕地',
    2: '林地',
    3: '草地',
    4: '水体',
    5: '冰雪',
    6: '裸地',
    7: '建设用地',
    8: '湿地',
    255: '其他'
};

// 逆向映射
const NAME_TO_CLASS = {};
Object.entries(LAND_CLASS_NAMES).forEach(([k, v]) => NAME_TO_CLASS[v] = parseInt(k));
// 同义词：建设用地
NAME_TO_CLASS['城镇'] = 7;
NAME_TO_CLASS['城市'] = 7;

function normalizeLandClassToken(value) {
    return String(value ?? '').trim();
}

function isAllLandClassToken(value) {
    const v = normalizeLandClassToken(value).replace(/\s+/g, '');
    if (!v) return true;
    if (v === '*' || v === 'ALL') return true;
    // 兼容：全部/任意/所有/全体等表达
    if (v.includes('全部') || v.includes('所有') || v.includes('任意') || v.includes('全体')) return true;
    if (v === '总流转' || v === '总转移' || v === '全部地类' || v === '全部土地' || v === '全部类型') return true;
    return false;
}

function parseLandClassToken(value) {
    const v = normalizeLandClassToken(value);
    if (isAllLandClassToken(v)) return null;
    return NAME_TO_CLASS[v] ?? null;
}

const spatialStatsTool = {
    name: 'spatial_stats_analysis',
    description: '获取土地利用流转的空间统计特征，包括重心迁移轨迹和标准差椭圆变化（如某类土地转化为建设用地的重心变化轨迹）。',
    keywords: ['空间统计', '重心', '迁移', '轨迹', '标准差椭圆', '空间流转', '方向', '偏移'],
    priority: 20,
    parameters: {
        type: 'object',
        properties: {
            yearStart: { type: 'integer', description: '起始年份，如 1985' },
            yearEnd: { type: 'integer', description: '结束年份，如 2023' },
            fromClassStr: { type: 'string', description: '转出地类，如 "林地", "耕地"' },
            toClassStr: { type: 'string', description: '转入地类，如 "建设用地"' },
            region: { type: 'string', description: '可选：限定空间统计所在的区域。' },
            top_n: { type: 'integer', description: '可选：核心高发区 TopN 数量（默认 5）。' }
        },
        required: ['yearStart', 'yearEnd', 'fromClassStr', 'toClassStr']
    },

    async query(args, entities, year = 2023) {
        let { yearStart, yearEnd, fromClassStr, toClassStr, region, top_n } = args;
        const targetRegion = region || entities.region || '云南省';
        const topN = Number.isFinite(Number(top_n)) ? Math.max(1, Math.floor(Number(top_n))) : 5;

        // 兼容逻辑...
        if (!yearStart || !yearEnd) {
            const years = entities.yearRange || entities.years || [1985, 2023];
            yearStart = years[0];
            yearEnd = years[years.length - 1] || 2023;
        }

        if (!fromClassStr || !toClassStr) {
            const types = entities.targetLandTypes || [];
            fromClassStr = types[0] || '林地';
            toClassStr = types[1] || '建设用地';
        }

        // 支持“净流入/净流出”的口径表达：
        // - 净流入(*->X)：fromClassStr="全部"，toClassStr="建设用地"
        // - 净流出(X->*)：fromClassStr="耕地"，toClassStr="全部"
        const fromClass = parseLandClassToken(fromClassStr) ?? (isAllLandClassToken(fromClassStr) ? null : 1);
        const toClass = parseLandClassToken(toClassStr) ?? (isAllLandClassToken(toClassStr) ? null : 7);

        // from/to 同时为具体地类时，禁止同类自转
        if (fromClass !== null && toClass !== null && fromClass === toClass) {
            throw new Error(`空间统计参数无效：fromClassStr 与 toClassStr 相同（${fromClassStr}）。请指定不同的转出/转入地类。`);
        }

        logger.info(`[spatialStatsTool] 计算坐标转移: ${fromClassStr}->${toClassStr} (${yearStart}-${yearEnd}), 区域: ${targetRegion}`);

        try {
            // 使用县级作为计算尺度
            const result = await queryTransferGeoJSON(
                'spatial_county_yunnan_transfer',
                yearStart, yearEnd,
                fromClass, toClass,
                'county',
                targetRegion
            );
            if (!result?.features?.length && result?.meta?.available_directions) {
                return {
                    type: 'spatial_stats',
                    yearStart, yearEnd,
                    fromClassStr, toClassStr,
                    features: [],
                    trajectory: [],
                    computed: {
                        emptyReason: result.meta?.message || '无数据',
                        availableDirections: result.meta.available_directions,
                        hint: result.meta?.hint
                    }
                };
            }

            // 获取时间切片的轨迹/重心/SDE：直接复用 period_encoder + queryTransferGeoJSON 在工具侧计算，
            // 避免走 HTTP 回调 /api/analysis 导致的 401（authMiddleware 保护）和不稳定。
            const trajectoryFeatures = [];
            try {
                const tableName = 'spatial_county_yunnan_transfer';
                const allPeriods = await getAvailablePeriods(pool, tableName);
                const activePeriods = sortPeriods(findOverlappingPeriods(allPeriods, Number(yearStart), Number(yearEnd)));

                const centersByPeriod = new Map();

                for (const period of activePeriods) {
                    const [pStart, pEnd] = decodePeriod(period);
                    const geo = await queryTransferGeoJSON(
                        tableName,
                        pStart,
                        pEnd,
                        fromClass,
                        toClass,
                        'county',
                        targetRegion,
                        { periods: [period] }
                    );

                    if (!geo?.features?.length) continue;

                    const points = [];
                    for (const feature of geo.features) {
                        const w = Number(feature?.properties?.transfer_area || 0);
                        if (!w || w <= 0) continue;
                        try {
                            const center = turf.centroid(feature);
                            center.properties = { weight: w };
                            points.push(center);
                        } catch {
                            // skip malformed geometry
                        }
                    }
                    if (points.length === 0) continue;

                    const pointCollection = turf.featureCollection(points);
                    const meanCenter = turf.centerMean(pointCollection, { weight: 'weight' });
                    meanCenter.properties = {
                        type: 'center',
                        period,
                        yearStart: pStart,
                        yearEnd: pEnd,
                        fromClass,
                        toClass
                    };

                    if (points.length >= 3) {
                        const sde = turf.standardDeviationalEllipse(pointCollection, { weight: 'weight', steps: 64 });
                        // Preserve turf-computed properties (standardDeviationalEllipse) and merge our metadata.
                        sde.properties = {
                            ...(sde.properties || {}),
                            type: 'sde',
                            period,
                            yearStart: pStart,
                            yearEnd: pEnd,
                            fromClass,
                            toClass
                        };
                        trajectoryFeatures.push(sde);
                    }

                    trajectoryFeatures.push(meanCenter);
                    centersByPeriod.set(period, meanCenter);
                }

                const coords = [];
                for (const period of activePeriods) {
                    const c = centersByPeriod.get(period);
                    if (c?.geometry?.coordinates) coords.push(c.geometry.coordinates);
                }
                if (coords.length >= 2) {
                    const line = turf.lineString(coords, {
                        type: 'trajectory',
                        yearStart: Number(yearStart),
                        yearEnd: Number(yearEnd),
                        fromClass,
                        toClass
                    });
                    trajectoryFeatures.push(line);
                }
            } catch (e) {
                logger.warn('[spatialStatsTool] Trajectory compute failed:', e?.message || e);
            }

            // 从 trajectory 中提取每期的 center/sde/trajectory，并预计算可直接引用的指标，避免模型自算。
            const centers = (trajectoryFeatures || []).filter((f) => f?.properties?.type === 'center');
            const sdes = (trajectoryFeatures || []).filter((f) => f?.properties?.type === 'sde');
            const trajLine = (trajectoryFeatures || []).find((f) => f?.properties?.type === 'trajectory');

            const centerShift = (() => {
                if (!centers || centers.length < 2) return null;
                const first = centers[0];
                const last = centers[centers.length - 1];
                if (!first?.geometry?.coordinates || !last?.geometry?.coordinates) return null;
                try {
                    const p1 = turf.point(first.geometry.coordinates);
                    const p2 = turf.point(last.geometry.coordinates);
                    const bearing = turf.bearing(p1, p2); // degrees, -180..180
                    const azimuth = turf.bearingToAzimuth(bearing); // degrees, 0..360
                    const distance_km = turf.distance(p1, p2, { units: 'kilometers' });
                    return {
                        start: { period: first.properties?.period, coord: first.geometry.coordinates },
                        end: { period: last.properties?.period, coord: last.geometry.coordinates },
                        bearing_deg: Number.isFinite(azimuth) ? azimuth : null,
                        bearing_deg_raw: Number.isFinite(bearing) ? bearing : null,
                        distance_km: Number.isFinite(distance_km) ? distance_km : null
                    };
                } catch {
                    return null;
                }
            })();

            const sdeStatsByPeriod = (sdes || []).map((f) => {
                const raw = f?.properties?.standardDeviationalEllipse;
                if (!raw) return null;
                const semiMajor = Number(raw.semiMajorAxis);
                const semiMinor = Number(raw.semiMinorAxis);
                const ratio = (Number.isFinite(semiMajor) && Number.isFinite(semiMinor) && semiMinor > 0)
                    ? (semiMajor / semiMinor)
                    : null;

                let area_km2 = null;
                try {
                    // turf.area returns m^2 for polygon geometry (in WGS84 coordinates, turf uses planar approximation),
                    // good enough for "trend/relative" diagnosis; we avoid model-side computation drift.
                    area_km2 = turf.area(f) / 1e6;
                } catch {
                    area_km2 = null;
                }

                return {
                    period: f?.properties?.period,
                    yearStart: f?.properties?.yearStart,
                    yearEnd: f?.properties?.yearEnd,
                    angle_deg: Number.isFinite(Number(raw.angle)) ? Number(raw.angle) : null,
                    semiMajorAxis: Number.isFinite(semiMajor) ? semiMajor : null,
                    semiMinorAxis: Number.isFinite(semiMinor) ? semiMinor : null,
                    area_km2: Number.isFinite(area_km2) ? area_km2 : null,
                    flattening_ratio: ratio
                };
            }).filter(Boolean);

            const topRegions = (() => {
                const feats = (result.features || []).filter((f) => Number(f?.properties?.transfer_area || 0) > 0);
                feats.sort((a, b) => Number(b?.properties?.transfer_area || 0) - Number(a?.properties?.transfer_area || 0));
                const top = feats.slice(0, topN);
                const total = feats.reduce((s, f) => s + Number(f?.properties?.transfer_area || 0), 0);
                const topSum = top.reduce((s, f) => s + Number(f?.properties?.transfer_area || 0), 0);
                return {
                    top_n: topN,
                    total_transfer_area_km2: total / 1e6,
                    top_transfer_area_km2: topSum / 1e6,
                    top_share: total > 0 ? (topSum / total) : null,
                    items: top.map((f, i) => ({
                        rank: i + 1,
                        name: f?.properties?.name,
                        transfer_area_km2: Number(f?.properties?.transfer_area || 0) / 1e6
                    }))
                };
            })();

            return {
                type: 'spatial_stats',
                yearStart, yearEnd,
                fromClassStr, toClassStr,
                features: result.features || [],
                trajectory: trajectoryFeatures,
                computed: {
                    topRegions,
                    centerShift,
                    sdeStatsByPeriod,
                    hasTrajectoryLine: !!trajLine
                }
            };
        } catch (err) {
            logger.error('[spatialStatsTool] 查询失败:', err);
            throw err;
        }
    },

    format(data, entities) {
        const { yearStart, yearEnd, fromClassStr, toClassStr, features, trajectory, computed } = data;

        if (!features || features.length === 0) {
            if (computed?.availableDirections) {
                const fromDirs = computed.availableDirections?.from || {};
                const toDirs = computed.availableDirections?.to || {};
                const fromList = Object.keys(fromDirs).sort().map((k) => `${k}->[${fromDirs[k].join(',')}]`).join('；');
                const toList = Object.keys(toDirs).sort().map((k) => `[${toDirs[k].join(',')}]->${k}`).join('；');
                return [
                    `> 空间特征统计：未找到 ${yearStart}-${yearEnd} 从 ${fromClassStr} 转为 ${toClassStr} 的显著空间转移。`,
                    `> 可能原因：该方向在当前 transfer 宽表中缺少字段（并非“没有变化”，而是“未建模/不可查”）。`,
                    computed?.hint ? `> 提示：${computed.hint}` : null,
                    fromList ? `> 当前可用转出方向(按编码): ${fromList}` : null,
                    toList ? `> 当前可用转入方向(按编码): ${toList}` : null
                ].filter(Boolean).join('\n');
            }
            return `> 空间特征统计：未找到 ${yearStart}-${yearEnd} 从 ${fromClassStr} 转为 ${toClassStr} 的显著空间转移。`;
        }

        let desc = `## 空间流转特征分析：${fromClassStr} 转化为 ${toClassStr} (${yearStart} - ${yearEnd})\n\n`;
        desc += `> 数据来源：平台后端 PostGIS 转移宽表（spatial_county_yunnan_transfer）与空间统计接口（/api/analysis/spatial-stats/transfer-series）查询结果。\n\n`;

        // 1. 核心高发区 (Top N)
        const topN = computed?.topRegions?.top_n || 15;
        const sorted = [...features].filter(f => f.properties && f.properties.transfer_area)
            .sort((a, b) => b.properties.transfer_area - a.properties.transfer_area)
            .slice(0, topN);

        if (sorted.length > 0) {
            desc += `### 转发生力最猛烈的核心县市区 (Top ${sorted.length})\n`;
            sorted.forEach((c, i) => {
                const area = (c.properties.transfer_area / 1e6).toFixed(2);
                desc += `- ${i + 1}. ${c.properties.name} (转化面积: ${area} km²)\n`;
            });
            desc += `\n`;
        }

        if (computed?.topRegions) {
            const share = (computed.topRegions.top_share === null || computed.topRegions.top_share === undefined)
                ? '—'
                : `${(computed.topRegions.top_share * 100).toFixed(2)}%`;
            desc += `> 头部集中度：Top ${computed.topRegions.top_n} 累计 ${computed.topRegions.top_transfer_area_km2.toFixed(2)} km²，占比 ${share}（全体转化合计 ${computed.topRegions.total_transfer_area_km2.toFixed(2)} km²）\n\n`;
        }

        // 2. 空间重心迁移轨迹
        if (trajectory && trajectory.length > 0) {
            const centers = trajectory.filter(f => f.properties && f.properties.type === 'center');
            if (centers.length > 0) {
                desc += `### 多时段偏移与空间重心迁移轨迹\n`;
                centers.forEach((c, i) => {
                    const coords = c.geometry.coordinates;
                    desc += `- 阶段 ${c.properties.period}: 转移活动重心落于 [经度 ${coords[0].toFixed(4)}, 纬度 ${coords[1].toFixed(4)}]\n`;
                });

                if (centers.length > 1) {
                    const first = centers[0].geometry.coordinates;
                    const last = centers[centers.length - 1].geometry.coordinates;
                    let dirX = last[0] > first[0] ? '东' : '西';
                    let dirY = last[1] > first[1] ? '北' : '南';
                    desc += `\n**极化趋势结论:** 从始至终，该转化的空间发生核心主要向 **${dirY}${dirX}** 方向持续偏移集聚。\n`;
                }
            }
        }

        if (computed?.centerShift?.distance_km != null || computed?.centerShift?.bearing_deg != null) {
            const dist = computed.centerShift.distance_km;
            const bear = computed.centerShift.bearing_deg;
            desc += `\n### 重心整体偏移（可直接引用）\n`;
            if (dist != null) desc += `- 偏移距离: ${dist.toFixed(2)} km\n`;
            if (bear != null) desc += `- 偏移方位角(°): ${bear.toFixed(2)}（以正北为0°，顺时针为正，范围 0-360°）\n`;
        }

        if (Array.isArray(computed?.sdeStatsByPeriod) && computed.sdeStatsByPeriod.length > 0) {
            desc += `\n### 标准差椭圆(SDE)关键参数（可直接引用）\n`;
            computed.sdeStatsByPeriod.forEach((s) => {
                const areaTxt = s.area_km2 == null ? '—' : s.area_km2.toFixed(2);
                const ratioTxt = s.flattening_ratio == null ? '—' : s.flattening_ratio.toFixed(3);
                const angleTxt = s.angle_deg == null ? '—' : s.angle_deg.toFixed(2);
                desc += `- 阶段 ${s.period}: 椭圆面积 ${areaTxt} km²，扁率(长短轴比) ${ratioTxt}，主轴角度 ${angleTxt}°\n`;
            });
        }

        return desc;
    }
};

registry.register(spatialStatsTool);
export default spatialStatsTool;
