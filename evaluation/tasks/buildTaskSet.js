#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const TASK_DIR = path.dirname(__filename);

const LAND_FIELDS = {
  耕地: 'cropland',
  林地: 'forest',
  灌木: 'shrub',
  草地: 'grassland',
  水体: 'water',
  湿地: 'wetland',
  建设用地: 'impervious',
  裸地: 'barren',
  冰雪: 'snow_ice'
};

const CATEGORY_NAMES = {
  structure_query: '土地利用结构查询',
  trend_analysis: '时序变化趋势分析',
  transfer_analysis: '土地利用转移分析',
  spatial_hotspot: '空间分异与热点识别',
  risk_scoring: '生态风险综合评分',
  policy_explanation: '政策解释与综合判断'
};

const DIFFICULTY_NAMES = {
  simple: '简单任务',
  composite: '复合任务',
  interpretive: '综合解释任务'
};

const POLICY_LABELS = {
  farmland_protection: '耕地保护优先',
  balanced: '均衡协同',
  ecological_protection: '生态保护优先',
  urban_development: '城镇发展优先',
  reforestation: '退耕还林导向'
};

function compactJson(value) {
  return JSON.stringify(value);
}

function mdCell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}

function clcdStructureTask({ id, difficulty, question, region, level, year, field, extract, expectedTools = ['clcd_analysis'], expectedExtra = {} }) {
  const args = { query_type: 'structure', region, level, year };
  return {
    id,
    category: 'structure_query',
    difficulty,
    question,
    expected_tools: expectedTools,
    expected_args: { clcd_analysis: args, ...expectedExtra },
    baseline: {
      tool: 'clcd_analysis',
      args,
      extract: extract || { type: 'numeric', path: `result.rows.0.${field}`, unit: 'm2' }
    }
  };
}

function clcdComparisonTask({ id, difficulty, question, regions, level, year, field, k = 3 }) {
  const args = { query_type: 'comparison', region: regions.join(','), level, year };
  return {
    id,
    category: 'structure_query',
    difficulty,
    question,
    expected_tools: ['clcd_analysis'],
    expected_args: { clcd_analysis: args },
    baseline: {
      tool: 'clcd_analysis',
      args,
      extract: { type: 'top_regions_by_field', path: 'result.rows', field, key: 'region_name', k, unit: 'm2' }
    }
  };
}

function clcdDominantTask({ id, difficulty, question, region, level, year, k = 3 }) {
  const args = { query_type: 'structure', region, level, year };
  return {
    id,
    category: 'structure_query',
    difficulty,
    question,
    expected_tools: ['clcd_analysis'],
    expected_args: { clcd_analysis: args },
    baseline: {
      tool: 'clcd_analysis',
      args,
      extract: { type: 'dominant_land_types', path: 'result.rows.0', k, unit: 'm2' }
    },
    manual_fact_units: [
      '回答应引用结构查询返回的面积或占比结果',
      '回答应指出优势地类或主要地类组合',
      '回答应避免脱离数据作驱动机制断言'
    ]
  };
}

function trendTask({ id, difficulty, question, region, level, yearRange, landType, expectedTools = ['clcd_analysis'], expectedExtra = {}, manual = false }) {
  const args = { query_type: 'trend', region, level, year_range: yearRange, land_type: landType };
  return {
    id,
    category: 'trend_analysis',
    difficulty,
    question,
    expected_tools: expectedTools,
    expected_args: { clcd_analysis: args, ...expectedExtra },
    baseline: {
      tool: 'clcd_analysis',
      args,
      extract: { type: 'trend', path: 'result.rows', field: LAND_FIELDS[landType], unit: 'm2' }
    },
    ...(manual ? {
      manual_fact_units: [
        '回答应给出起止年份面积或变化方向',
        '回答应说明增减趋势与变化幅度',
        '解释性结论应回指时序数据证据'
      ]
    } : {})
  };
}

function transferTask({ id, difficulty, question, region, level, startYear, endYear, expectedTools = ['land_transfer_analysis'], expectedExtra = {}, manual = false }) {
  const args = { region, level, start_year: startYear, end_year: endYear };
  return {
    id,
    category: 'transfer_analysis',
    difficulty,
    question,
    expected_tools: expectedTools,
    expected_args: { land_transfer_analysis: args, ...expectedExtra },
    baseline: {
      tool: 'land_transfer_analysis',
      args,
      extract: { type: 'top_transitions', path: 'result.rows', k: 5, unit: 'm2' }
    },
    ...(manual ? {
      manual_fact_units: [
        '回答应列出主导土地利用转移方向',
        '回答应说明转入、转出或空间冲突含义',
        '解释性判断应避免把土地利用转移写成土地流转'
      ]
    } : {})
  };
}

function spatialTopTask({ id, difficulty, question, yearStart, yearEnd, fromClassStr, toClassStr, topN = 5, expectedTools = ['spatial_stats_analysis'], expectedExtra = {}, manual = false }) {
  const args = { yearStart, yearEnd, fromClassStr, toClassStr, region: '云南省', top_n: topN };
  return {
    id,
    category: 'spatial_hotspot',
    difficulty,
    question,
    expected_tools: expectedTools,
    expected_args: { spatial_stats_analysis: args, ...expectedExtra },
    baseline: {
      tool: 'spatial_stats_analysis',
      args,
      extract: { type: 'top_regions', path: 'result.computed.topRegions.items', key: 'name', k: topN }
    },
    ...(manual ? {
      manual_fact_units: [
        '回答应给出热点县域或空间集聚区',
        '回答应说明热点格局与空间统计证据之间的关系',
        '回答应避免仅凭常识推断热点'
      ]
    } : {})
  };
}

function spatialNumericTask({ id, difficulty, question, yearStart, yearEnd, fromClassStr, toClassStr, extract, expectedTools = ['spatial_stats_analysis'], expectedExtra = {}, manual = false }) {
  const args = { yearStart, yearEnd, fromClassStr, toClassStr, region: '云南省', top_n: 5 };
  return {
    id,
    category: 'spatial_hotspot',
    difficulty,
    question,
    expected_tools: expectedTools,
    expected_args: { spatial_stats_analysis: args, ...expectedExtra },
    baseline: {
      tool: 'spatial_stats_analysis',
      args,
      extract
    },
    ...(manual ? {
      manual_fact_units: [
        '回答应引用重心迁移或标准差椭圆指标',
        '回答应说明空间方向、离散程度或集聚变化',
        '回答应区分定量指标与解释性判断'
      ]
    } : {})
  };
}

function riskTask({ id, difficulty, question, region, level, year, policy, expectedTools = ['clcd_analysis'], expectedExtra = {}, manual = false }) {
  const args = { query_type: 'monitoring', region, level, year, policy };
  return {
    id,
    category: 'risk_scoring',
    difficulty,
    question,
    expected_tools: expectedTools,
    expected_args: { clcd_analysis: args, ...expectedExtra },
    baseline: {
      tool: 'clcd_analysis',
      args,
      extract: { type: 'numeric', path: 'result.compositeScore', unit: 'score' }
    },
    ...(manual ? {
      manual_fact_units: [
        `回答应说明${POLICY_LABELS[policy] || policy}情景下的综合风险评分`,
        '回答应引用工具返回的核心指标或权重信息',
        '回答应说明该分值属于相对预警评分而非真实生态过程直接测量'
      ]
    } : {})
  };
}

function policyTask({ id, difficulty, question, region, level, keywords, year, yearRange, expectedTools = ['policy_reference_lookup'], expectedExtra = {}, manualUnits }) {
  const args = {
    ...(region ? { region } : {}),
    ...(level ? { level } : {}),
    ...(year ? { year } : {}),
    ...(yearRange ? { year_range: yearRange } : {}),
    keywords,
    top_n: 5
  };
  return {
    id,
    category: 'policy_explanation',
    difficulty,
    question,
    expected_tools: expectedTools,
    expected_args: { policy_reference_lookup: args, ...expectedExtra },
    baseline: {
      tool: 'policy_reference_lookup',
      args,
      extract: { type: 'fact_units', path: 'result.hits', key: 'summary' }
    },
    manual_fact_units: manualUnits || [
      '回答应引用政策或规划索引来源',
      '回答应说明政策约束与土地利用变化之间的关系',
      '回答应避免无来源背诵政策标题'
    ]
  };
}

const tasks = {
  structure_query: [
    clcdStructureTask({ id: 'structure-simple-001', difficulty: 'simple', question: '2020年昆明市建设用地面积是多少？', region: '昆明市', level: 'prefecture', year: 2020, field: 'impervious' }),
    clcdStructureTask({ id: 'structure-simple-002', difficulty: 'simple', question: '2020年曲靖市耕地面积是多少？', region: '曲靖市', level: 'prefecture', year: 2020, field: 'cropland' }),
    clcdStructureTask({ id: 'structure-simple-003', difficulty: 'simple', question: '2015年云南省林地面积是多少？', region: '云南省', level: 'province', year: 2015, field: 'forest' }),
    clcdStructureTask({ id: 'structure-simple-004', difficulty: 'simple', question: '2023年玉溪市水体面积是多少？', region: '玉溪市', level: 'prefecture', year: 2023, field: 'water' }),
    clcdComparisonTask({ id: 'structure-composite-001', difficulty: 'composite', question: '2020年昆明市、曲靖市和玉溪市建设用地面积由高到低如何排序？', regions: ['昆明市', '曲靖市', '玉溪市'], level: 'prefecture', year: 2020, field: 'impervious' }),
    clcdComparisonTask({ id: 'structure-composite-002', difficulty: 'composite', question: '2020年大理白族自治州、红河哈尼族彝族自治州和西双版纳傣族自治州林地面积由高到低如何排序？', regions: ['大理白族自治州', '红河哈尼族彝族自治州', '西双版纳傣族自治州'], level: 'prefecture', year: 2020, field: 'forest' }),
    clcdComparisonTask({ id: 'structure-composite-003', difficulty: 'composite', question: '2010年昭通市、曲靖市和文山壮族苗族自治州耕地面积由高到低如何排序？', regions: ['昭通市', '曲靖市', '文山壮族苗族自治州'], level: 'prefecture', year: 2010, field: 'cropland' }),
    clcdComparisonTask({ id: 'structure-composite-004', difficulty: 'composite', question: '2023年昆明市、丽江市和普洱市水体面积由高到低如何排序？', regions: ['昆明市', '丽江市', '普洱市'], level: 'prefecture', year: 2023, field: 'water' }),
    clcdDominantTask({ id: 'structure-interpretive-001', difficulty: 'interpretive', question: '2020年昆明市土地利用结构中面积最大的地类是什么？请结合面积结果解释其空间含义。', region: '昆明市', level: 'prefecture', year: 2020, k: 1 }),
    clcdDominantTask({ id: 'structure-interpretive-002', difficulty: 'interpretive', question: '2023年云南省土地利用结构中前三位地类是什么？请概括全省土地利用结构特征。', region: '云南省', level: 'province', year: 2023, k: 3 }),
    clcdDominantTask({ id: 'structure-interpretive-003', difficulty: 'interpretive', question: '2015年曲靖市土地利用结构以哪些地类为主？请给出前三类并简要解释。', region: '曲靖市', level: 'prefecture', year: 2015, k: 3 }),
    clcdDominantTask({ id: 'structure-interpretive-004', difficulty: 'interpretive', question: '2020年大理白族自治州土地利用结构中生态空间相关地类是否占主导？请依据主要地类面积回答。', region: '大理白族自治州', level: 'prefecture', year: 2020, k: 3 })
  ],

  trend_analysis: [
    trendTask({ id: 'trend-simple-001', difficulty: 'simple', question: '1990—2020年云南省建设用地变化趋势如何？', region: '云南省', level: 'province', yearRange: [1990, 2020], landType: '建设用地' }),
    trendTask({ id: 'trend-simple-002', difficulty: 'simple', question: '2000—2023年昆明市建设用地面积是增加还是减少？', region: '昆明市', level: 'prefecture', yearRange: [2000, 2023], landType: '建设用地' }),
    trendTask({ id: 'trend-simple-003', difficulty: 'simple', question: '1990—2020年云南省耕地面积变化方向是什么？', region: '云南省', level: 'province', yearRange: [1990, 2020], landType: '耕地' }),
    trendTask({ id: 'trend-simple-004', difficulty: 'simple', question: '2000—2020年曲靖市耕地面积变化趋势如何？', region: '曲靖市', level: 'prefecture', yearRange: [2000, 2020], landType: '耕地' }),
    trendTask({ id: 'trend-composite-001', difficulty: 'composite', question: '1985—2023年云南省林地长期变化趋势和净变化幅度如何？', region: '云南省', level: 'province', yearRange: [1985, 2023], landType: '林地' }),
    trendTask({ id: 'trend-composite-002', difficulty: 'composite', question: '2000—2023年云南省建设用地变化幅度如何？请说明总体扩张方向。', region: '云南省', level: 'province', yearRange: [2000, 2023], landType: '建设用地' }),
    trendTask({ id: 'trend-composite-003', difficulty: 'composite', question: '2010—2020年云南省草地面积变化方向和变化幅度如何？', region: '云南省', level: 'province', yearRange: [2010, 2020], landType: '草地' }),
    trendTask({ id: 'trend-composite-004', difficulty: 'composite', question: '2000—2020年红河哈尼族彝族自治州建设用地变化趋势如何？', region: '红河哈尼族彝族自治州', level: 'prefecture', yearRange: [2000, 2020], landType: '建设用地' }),
    trendTask({ id: 'trend-interpretive-001', difficulty: 'interpretive', question: '1990—2020年云南省建设用地扩张如何与城镇化进程联系起来？请先给出趋势证据再解释。', region: '云南省', level: 'province', yearRange: [1990, 2020], landType: '建设用地', expectedTools: ['clcd_analysis', 'knowledge_base_lookup'], expectedExtra: { knowledge_base_lookup: { skill_name: 'policy_expert' } }, manual: true }),
    trendTask({ id: 'trend-interpretive-002', difficulty: 'interpretive', question: '2000—2023年昆明市建设用地变化可能反映哪些空间治理压力？请依据趋势结果回答。', region: '昆明市', level: 'prefecture', yearRange: [2000, 2023], landType: '建设用地', expectedTools: ['clcd_analysis', 'knowledge_base_lookup'], expectedExtra: { knowledge_base_lookup: { skill_name: 'policy_expert' } }, manual: true }),
    trendTask({ id: 'trend-interpretive-003', difficulty: 'interpretive', question: '1990—2020年云南省耕地变化与耕地保护要求有什么关系？请结合趋势证据和政策语境说明。', region: '云南省', level: 'province', yearRange: [1990, 2020], landType: '耕地', expectedTools: ['clcd_analysis', 'policy_reference_lookup'], expectedExtra: { policy_reference_lookup: { region: '云南省', level: 'province', top_n: 5 } }, manual: true }),
    trendTask({ id: 'trend-interpretive-004', difficulty: 'interpretive', question: '2010—2023年云南省林地变化如何理解生态保护成效？请以趋势数据为依据作谨慎解释。', region: '云南省', level: 'province', yearRange: [2010, 2023], landType: '林地', expectedTools: ['clcd_analysis', 'policy_reference_lookup'], expectedExtra: { policy_reference_lookup: { region: '云南省', level: 'province', top_n: 5 } }, manual: true })
  ],

  transfer_analysis: [
    transferTask({ id: 'transfer-simple-001', difficulty: 'simple', question: '2010—2020年云南省主要土地利用转移方向有哪些？请列出前5类。', region: '云南省', level: 'province', startYear: 2010, endYear: 2020 }),
    transferTask({ id: 'transfer-simple-002', difficulty: 'simple', question: '2000—2020年云南省主要地类转移方向Top5是什么？', region: '云南省', level: 'province', startYear: 2000, endYear: 2020 }),
    transferTask({ id: 'transfer-simple-003', difficulty: 'simple', question: '2010—2020年昆明市主要土地利用转移方向Top5是什么？', region: '昆明市', level: 'prefecture', startYear: 2010, endYear: 2020 }),
    transferTask({ id: 'transfer-simple-004', difficulty: 'simple', question: '2000—2023年云南省土地利用转移面积最大的前5个方向是什么？', region: '云南省', level: 'province', startYear: 2000, endYear: 2023 }),
    transferTask({ id: 'transfer-composite-001', difficulty: 'composite', question: '1990—2020年云南省地类转换最强的前5类是什么？请说明转入与转出关系。', region: '云南省', level: 'province', startYear: 1990, endYear: 2020 }),
    transferTask({ id: 'transfer-composite-002', difficulty: 'composite', question: '2000—2020年曲靖市主导土地利用转移方向是什么？请列出Top5。', region: '曲靖市', level: 'prefecture', startYear: 2000, endYear: 2020 }),
    transferTask({ id: 'transfer-composite-003', difficulty: 'composite', question: '2010—2023年红河哈尼族彝族自治州主要地类转移方向有哪些？', region: '红河哈尼族彝族自治州', level: 'prefecture', startYear: 2010, endYear: 2023 }),
    transferTask({ id: 'transfer-composite-004', difficulty: 'composite', question: '2000—2023年大理白族自治州主要土地利用转移方向Top5是什么？', region: '大理白族自治州', level: 'prefecture', startYear: 2000, endYear: 2023 }),
    transferTask({ id: 'transfer-interpretive-001', difficulty: 'interpretive', question: '2000—2023年云南省耕地与建设用地相关转移反映了什么空间冲突？请先列出主导转移方向再解释。', region: '云南省', level: 'province', startYear: 2000, endYear: 2023, expectedTools: ['land_transfer_analysis', 'knowledge_base_lookup'], expectedExtra: { knowledge_base_lookup: { skill_name: 'policy_expert' } }, manual: true }),
    transferTask({ id: 'transfer-interpretive-002', difficulty: 'interpretive', question: '2010—2020年昆明市主导转移方向说明了怎样的城镇扩张特征？请结合转移矩阵回答。', region: '昆明市', level: 'prefecture', startYear: 2010, endYear: 2020, expectedTools: ['land_transfer_analysis', 'knowledge_base_lookup'], expectedExtra: { knowledge_base_lookup: { skill_name: 'spatial_reasoning' } }, manual: true }),
    transferTask({ id: 'transfer-interpretive-003', difficulty: 'interpretive', question: '1990—2020年云南省林地、草地、耕地之间的主要转移如何理解生态空间演变？', region: '云南省', level: 'province', startYear: 1990, endYear: 2020, expectedTools: ['land_transfer_analysis', 'knowledge_base_lookup'], expectedExtra: { knowledge_base_lookup: { skill_name: 'spatial_reasoning' } }, manual: true }),
    transferTask({ id: 'transfer-interpretive-004', difficulty: 'interpretive', question: '2000—2020年曲靖市转移矩阵中哪些地类转移方向值得预警？请用Top5结果支撑判断。', region: '曲靖市', level: 'prefecture', startYear: 2000, endYear: 2020, expectedTools: ['land_transfer_analysis', 'knowledge_base_lookup'], expectedExtra: { knowledge_base_lookup: { skill_name: 'policy_expert' } }, manual: true })
  ],

  spatial_hotspot: [
    spatialTopTask({ id: 'spatial-simple-001', difficulty: 'simple', question: '2000—2020年云南省转为建设用地的县域热点集中在哪些地方？请给出Top5。', yearStart: 2000, yearEnd: 2020, fromClassStr: '全部', toClassStr: '建设用地' }),
    spatialTopTask({ id: 'spatial-simple-002', difficulty: 'simple', question: '2010—2020年云南省耕地转为建设用地的县域热点Top5是哪些？', yearStart: 2010, yearEnd: 2020, fromClassStr: '耕地', toClassStr: '建设用地' }),
    spatialTopTask({ id: 'spatial-simple-003', difficulty: 'simple', question: '2000—2023年云南省草地转为建设用地的县域热点Top5是哪些？', yearStart: 2000, yearEnd: 2023, fromClassStr: '草地', toClassStr: '建设用地' }),
    spatialTopTask({ id: 'spatial-simple-004', difficulty: 'simple', question: '1990—2020年云南省转为耕地的县域热点Top5是哪些？', yearStart: 1990, yearEnd: 2020, fromClassStr: '全部', toClassStr: '耕地' }),
    spatialNumericTask({ id: 'spatial-composite-001', difficulty: 'composite', question: '2000—2020年云南省转为建设用地活动的空间重心迁移距离是多少？', yearStart: 2000, yearEnd: 2020, fromClassStr: '全部', toClassStr: '建设用地', extract: { type: 'numeric', path: 'result.computed.centerShift.distance_km', unit: 'km' } }),
    spatialNumericTask({ id: 'spatial-composite-002', difficulty: 'composite', question: '2010—2023年云南省耕地转为建设用地的空间重心迁移距离是多少？', yearStart: 2010, yearEnd: 2023, fromClassStr: '耕地', toClassStr: '建设用地', extract: { type: 'numeric', path: 'result.computed.centerShift.distance_km', unit: 'km' } }),
    spatialNumericTask({ id: 'spatial-composite-003', difficulty: 'composite', question: '2000—2020年云南省转为建设用地活动末期标准差椭圆面积是多少？', yearStart: 2000, yearEnd: 2020, fromClassStr: '全部', toClassStr: '建设用地', extract: { type: 'sde_last_numeric', path: 'result.computed.sdeStatsByPeriod', field: 'area_km2', unit: 'km2' } }),
    spatialNumericTask({ id: 'spatial-composite-004', difficulty: 'composite', question: '2000—2023年云南省草地转为建设用地活动末期标准差椭圆扁率是多少？', yearStart: 2000, yearEnd: 2023, fromClassStr: '草地', toClassStr: '建设用地', extract: { type: 'sde_last_numeric', path: 'result.computed.sdeStatsByPeriod', field: 'flattening_ratio', unit: 'ratio' } }),
    spatialTopTask({ id: 'spatial-interpretive-001', difficulty: 'interpretive', question: '2000—2020年云南省建设用地转入热点格局是否集中在滇中？请依据Top5县域结果解释。', yearStart: 2000, yearEnd: 2020, fromClassStr: '全部', toClassStr: '建设用地', expectedTools: ['spatial_stats_analysis', 'knowledge_base_lookup'], expectedExtra: { knowledge_base_lookup: { skill_name: 'spatial_reasoning' } }, manual: true }),
    spatialNumericTask({ id: 'spatial-interpretive-002', difficulty: 'interpretive', question: '2010—2023年云南省耕地转为建设用地的重心迁移说明什么空间扩张方向？请引用迁移指标。', yearStart: 2010, yearEnd: 2023, fromClassStr: '耕地', toClassStr: '建设用地', extract: { type: 'numeric', path: 'result.computed.centerShift.distance_km', unit: 'km' }, expectedTools: ['spatial_stats_analysis', 'knowledge_base_lookup'], expectedExtra: { knowledge_base_lookup: { skill_name: 'spatial_reasoning' } }, manual: true }),
    spatialTopTask({ id: 'spatial-interpretive-003', difficulty: 'interpretive', question: '2000—2023年云南省草地转为建设用地的热点格局说明了什么生态空间压力？', yearStart: 2000, yearEnd: 2023, fromClassStr: '草地', toClassStr: '建设用地', expectedTools: ['spatial_stats_analysis', 'knowledge_base_lookup'], expectedExtra: { knowledge_base_lookup: { skill_name: 'policy_expert' } }, manual: true }),
    spatialTopTask({ id: 'spatial-interpretive-004', difficulty: 'interpretive', question: '1990—2020年云南省转为建设用地的县域热点与城镇发展格局有什么关系？请用热点结果支撑判断。', yearStart: 1990, yearEnd: 2020, fromClassStr: '全部', toClassStr: '建设用地', expectedTools: ['spatial_stats_analysis', 'knowledge_base_lookup'], expectedExtra: { knowledge_base_lookup: { skill_name: 'spatial_reasoning' } }, manual: true })
  ],

  risk_scoring: [
    riskTask({ id: 'risk-simple-001', difficulty: 'simple', question: '2020年昆明市在均衡协同情景下的综合生态风险评分是多少？', region: '昆明市', level: 'prefecture', year: 2020, policy: 'balanced' }),
    riskTask({ id: 'risk-simple-002', difficulty: 'simple', question: '2023年云南省在均衡协同情景下的综合生态风险评分是多少？', region: '云南省', level: 'province', year: 2023, policy: 'balanced' }),
    riskTask({ id: 'risk-simple-003', difficulty: 'simple', question: '2020年曲靖市在生态保护优先情景下的综合生态风险评分是多少？', region: '曲靖市', level: 'prefecture', year: 2020, policy: 'ecological_protection' }),
    riskTask({ id: 'risk-simple-004', difficulty: 'simple', question: '2015年玉溪市在耕地保护优先情景下的综合生态风险评分是多少？', region: '玉溪市', level: 'prefecture', year: 2015, policy: 'farmland_protection' }),
    riskTask({ id: 'risk-composite-001', difficulty: 'composite', question: '2020年昆明市在耕地保护优先情景下的综合生态风险评分及风险状态如何？', region: '昆明市', level: 'prefecture', year: 2020, policy: 'farmland_protection' }),
    riskTask({ id: 'risk-composite-002', difficulty: 'composite', question: '2020年昆明市在城镇发展优先情景下的综合生态风险评分是多少？', region: '昆明市', level: 'prefecture', year: 2020, policy: 'urban_development' }),
    riskTask({ id: 'risk-composite-003', difficulty: 'composite', question: '2023年云南省在生态保护优先情景下的综合生态风险评分是多少？', region: '云南省', level: 'province', year: 2023, policy: 'ecological_protection' }),
    riskTask({ id: 'risk-composite-004', difficulty: 'composite', question: '2020年大理白族自治州在退耕还林导向情景下的综合生态风险评分是多少？', region: '大理白族自治州', level: 'prefecture', year: 2020, policy: 'reforestation' }),
    riskTask({ id: 'risk-interpretive-001', difficulty: 'interpretive', question: '2020年昆明市均衡协同情景下综合生态风险为什么较高或较低？请引用评分和核心指标解释。', region: '昆明市', level: 'prefecture', year: 2020, policy: 'balanced', expectedTools: ['clcd_analysis', 'knowledge_base_lookup'], expectedExtra: { knowledge_base_lookup: { skill_name: 'monitoring_indices' } }, manual: true }),
    riskTask({ id: 'risk-interpretive-002', difficulty: 'interpretive', question: '2023年云南省生态保护优先情景下的综合生态风险结果说明什么？请结合评分谨慎解释。', region: '云南省', level: 'province', year: 2023, policy: 'ecological_protection', expectedTools: ['clcd_analysis', 'knowledge_base_lookup'], expectedExtra: { knowledge_base_lookup: { skill_name: 'monitoring_indices' } }, manual: true }),
    riskTask({ id: 'risk-interpretive-003', difficulty: 'interpretive', question: '2020年曲靖市耕地保护优先情景下的综合生态风险对耕地保护预警有什么启示？', region: '曲靖市', level: 'prefecture', year: 2020, policy: 'farmland_protection', expectedTools: ['clcd_analysis', 'knowledge_base_lookup'], expectedExtra: { knowledge_base_lookup: { skill_name: 'policy_expert' } }, manual: true }),
    riskTask({ id: 'risk-interpretive-004', difficulty: 'interpretive', question: '2020年红河哈尼族彝族自治州城镇发展优先情景下的综合生态风险结果如何解释？', region: '红河哈尼族彝族自治州', level: 'prefecture', year: 2020, policy: 'urban_development', expectedTools: ['clcd_analysis', 'knowledge_base_lookup'], expectedExtra: { knowledge_base_lookup: { skill_name: 'monitoring_indices' } }, manual: true })
  ],

  policy_explanation: [
    policyTask({ id: 'policy-simple-001', difficulty: 'simple', question: '云南省国土空间规划中与耕地保护有关的政策依据有哪些？', region: '云南省', level: 'province', keywords: ['国土空间规划', '耕地保护'] }),
    policyTask({ id: 'policy-simple-002', difficulty: 'simple', question: '三条控制线对建设用地扩张约束的政策依据是什么？', region: '全国', level: 'national', keywords: ['三条控制线', '建设用地', '用途管制'] }),
    policyTask({ id: 'policy-simple-003', difficulty: 'simple', question: '生态保护红线相关政策依据有哪些？', region: '全国', level: 'national', keywords: ['生态保护红线', '生态保护'] }),
    policyTask({ id: 'policy-simple-004', difficulty: 'simple', question: '耕地非农化和占补平衡相关政策依据有哪些？', region: '全国', level: 'national', keywords: ['耕地保护', '非农化', '占补平衡'] }),
    policyTask({ id: 'policy-composite-001', difficulty: 'composite', question: '云南省建设用地扩张与耕地保护、生态保护要求有什么关系？请给出政策依据。', region: '云南省', level: 'province', keywords: ['国土空间规划', '耕地保护', '生态保护'] }),
    policyTask({ id: 'policy-composite-002', difficulty: 'composite', question: '昆明市城镇开发与国土空间规划管控之间有什么关系？请检索政策依据。', region: '昆明市', level: 'city', keywords: ['城镇开发边界', '国土空间规划', '用途管制'] }),
    policyTask({ id: 'policy-composite-003', difficulty: 'composite', question: '2019年以来三条控制线和用途管制如何约束土地利用变化？请给出政策依据。', region: '全国', level: 'national', yearRange: [2019, 2024], keywords: ['三条控制线', '用途管制', '国土空间规划'] }),
    policyTask({ id: 'policy-composite-004', difficulty: 'composite', question: '2020年以来耕地保护政策对建设用地扩张提出了哪些约束？请检索依据。', region: '全国', level: 'national', yearRange: [2020, 2024], keywords: ['耕地保护', '建设用地', '非农化'] }),
    policyTask({ id: 'policy-interpretive-001', difficulty: 'interpretive', question: '请将云南省建设用地扩张热点与国土空间规划管控联系起来，给出政策依据和解释。', region: '云南省', level: 'province', keywords: ['国土空间规划', '建设用地', '三条控制线'], expectedTools: ['policy_reference_lookup', 'spatial_stats_analysis'], expectedExtra: { spatial_stats_analysis: { yearStart: 2000, yearEnd: 2020, fromClassStr: '全部', toClassStr: '建设用地', region: '云南省' } } }),
    policyTask({ id: 'policy-interpretive-002', difficulty: 'interpretive', question: '请解释耕地转为建设用地与永久基本农田保护之间的关系，并给出政策依据。', region: '全国', level: 'national', keywords: ['永久基本农田', '耕地保护', '建设用地'], expectedTools: ['policy_reference_lookup', 'spatial_stats_analysis'], expectedExtra: { spatial_stats_analysis: { yearStart: 2010, yearEnd: 2020, fromClassStr: '耕地', toClassStr: '建设用地', region: '云南省' } } }),
    policyTask({ id: 'policy-interpretive-003', difficulty: 'interpretive', question: '生态风险预警结果如何服务国土空间用途管制？请给出政策依据并说明系统应用价值。', region: '云南省', level: 'province', keywords: ['生态保护', '用途管制', '国土空间规划'], expectedTools: ['policy_reference_lookup', 'clcd_analysis'], expectedExtra: { clcd_analysis: { query_type: 'monitoring', region: '云南省', level: 'province', year: 2023, policy: 'ecological_protection' } } }),
    policyTask({ id: 'policy-interpretive-004', difficulty: 'interpretive', question: '结合云南省国土空间规划，说明WebGIS-GeoAI Agent系统结果如何支持监测预警和辅助决策。', region: '云南省', level: 'province', keywords: ['国土空间规划', '监测预警', '辅助决策'], expectedTools: ['policy_reference_lookup', 'knowledge_base_lookup'], expectedExtra: { knowledge_base_lookup: { skill_name: 'policy_expert' } } })
  ]
};

function validateTasks() {
  const all = Object.values(tasks).flat();
  const ids = new Set();
  for (const task of all) {
    if (ids.has(task.id)) throw new Error(`重复任务ID: ${task.id}`);
    ids.add(task.id);
  }
  if (all.length !== 72) throw new Error(`任务总数应为72，当前为${all.length}`);
  for (const [category, rows] of Object.entries(tasks)) {
    if (rows.length !== 12) throw new Error(`${category} 应为12题，当前为${rows.length}`);
    for (const difficulty of Object.keys(DIFFICULTY_NAMES)) {
      const count = rows.filter((task) => task.difficulty === difficulty).length;
      if (count !== 4) throw new Error(`${category}/${difficulty} 应为4题，当前为${count}`);
    }
  }
}

function makeMarkdown() {
  const lines = [
    '# GeoAI Agent 分层均衡评价任务表（72题）',
    '',
    '本表为正式评价实验题库。任务围绕 LUCC 监测系统典型业务流程构建，包括土地利用结构查询、时序变化趋势分析、土地利用转移分析、空间分异与热点识别、生态风险综合评分、政策解释与综合判断6类任务。每类任务按简单任务、复合任务和综合解释任务3个难度层级设置，每个层级4题，共72题。',
    '',
    '| 序号 | 任务ID | 任务类别 | 难度层级 | 自然语言问题 | 期望工具 | 关键参数 | 基准结果抽取口径 |',
    '| ---: | --- | --- | --- | --- | --- | --- | --- |'
  ];

  let index = 1;
  for (const [category, rows] of Object.entries(tasks)) {
    for (const task of rows) {
      lines.push([
        index,
        task.id,
        CATEGORY_NAMES[category] || category,
        DIFFICULTY_NAMES[task.difficulty] || task.difficulty,
        task.question,
        task.expected_tools.join(', '),
        compactJson(task.expected_args),
        compactJson(task.baseline.extract)
      ].map(mdCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
      index += 1;
    }
  }

  lines.push('');
  lines.push('> 说明：`expected_tools` 用于计算工具调用准确率，`expected_args` 用于计算关键参数解析准确率，`baseline.extract` 用于从MCP工具结构化结果中抽取可复核基准值。');
  return lines.join('\n');
}

async function main() {
  validateTasks();
  for (const [category, rows] of Object.entries(tasks)) {
    await fs.writeFile(path.join(TASK_DIR, `${category}.json`), `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  }
  await fs.writeFile(path.join(TASK_DIR, 'task_design_72.md'), `${makeMarkdown()}\n`, 'utf8');
  console.log('[eval-tasks] generated 72 tasks');
  console.log(`[eval-tasks] output=${path.join(TASK_DIR, 'task_design_72.md')}`);
}

main().catch((err) => {
  console.error(`[eval-tasks] fatal: ${err?.stack || err?.message || String(err)}`);
  process.exitCode = 1;
});
