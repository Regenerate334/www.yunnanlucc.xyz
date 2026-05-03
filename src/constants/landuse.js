/**
 * 土地利用相关业务常量配置 (CLCD & 行政区划)
 */

export const CLCD_COLORS = {
    cropland: '#fae39c',
    forest: '#446f33',
    shrub: '#33a02c',
    grassland: '#abd37b',
    water: '#1e69b4',
    snow_ice: '#a6cee3',
    barren: '#cfbda3',
    impervious: '#e24290',
    wetland: '#289be8'
};

export const LANDUSE_NAMES = {
    cropland: '耕地',
    forest: '林地',
    shrub: '灌木',
    grassland: '草地',
    water: '水域',
    snow_ice: '冰雪',
    barren: '裸地',
    impervious: '建设用地',
    wetland: '湿地'
};

export const LEGEND_CONFIGS = {
    cropland: {
        // 耕地：使用更有质感的黄绿色系过渡
        colors: ['#fff9db', '#fff3bf', '#ffec99', '#ffe066', '#ffd43b', '#fcc419', '#fab005', '#f59f00', '#f08c00', '#e67700']
    },
    forest: {
        // 林地：深邃的森林绿
        colors: ['#ebfbee', '#d3f9d8', '#b2f2bb', '#8ce99a', '#69db7c', '#51cf66', '#40c057', '#37b24d', '#2f9e44', '#2b8a3e']
    },
    shrub: {
        // 灌木：绿中带黄
        colors: ['#f4fce3', '#e9fac8', '#d8f5a2', '#c0eb75', '#a9e34b', '#94d82d', '#82c91e', '#74b816', '#66a80f', '#5c940d']
    },
    grassland: {
        // 草地：翠绿色调
        colors: ['#f0fff4', '#dcffe4', '#befade', '#96f2d7', '#63e6be', '#38d9a9', '#20c997', '#12b886', '#0ca678', '#099268']
    },
    water: {
        // 水域：清澈到深沉的蓝色
        colors: ['#e7f5ff', '#d0ebff', '#a5d8ff', '#74c0fc', '#4dabf7', '#339af0', '#228be6', '#1c7ed6', '#1971c2', '#1864ab']
    },
    wetland: {
        // 湿地：青绿色系
        colors: ['#e6fffa', '#c5f6fa', '#99e9f2', '#66d9e8', '#3bc9db', '#22b8cf', '#15aabf', '#1098ad', '#0c8599', '#0b7285']
    },
    impervious: {
        // 建设用地：柔和的灰紫到深红
        colors: ['#fff5f5', '#ffe3e3', '#ffc9c9', '#ffa8a8', '#ff8787', '#ff6b6b', '#fa5252', '#f03e3e', '#e03131', '#c92a2a']
    },
    barren: {
        // 裸地：土色系
        colors: ['#fff9db', '#fff3bf', '#ffec99', '#ffe066', '#ffd43b', '#fcc419', '#fab005', '#f59f00', '#f08c00', '#e67700']
    },
    snow_ice: {
        // 冰雪：高亮的蓝灰色
        colors: ['#f8f9fa', '#f1f3f5', '#e9ecef', '#dee2e6', '#ced4da', '#adb5bd', '#868e96', '#495057', '#343a40', '#212529']
    },
    reclamation: {
        colors: ['#f7fcf5', '#c7e9c0', '#a1d99b', '#74c476', '#fed976', '#feb24c', '#fd8d3c', '#e31a1c', '#bd0026', '#800026']
    },
    conversion: {
        colors: ['#fffcf2', '#fff1ba', '#ffdc71', '#ffb63a', '#ff8e21', '#ff5a1d', '#e02d44', '#b31564', '#7e0a6d', '#4d0352']
    },
    change_mode: {
        colors: ['#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#f7f7f7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac']
    }
};

export const SDE_COLORS = [
    '#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999'
];

export const PREFECTURE_SHORT_NAMES = {
    '楚雄彝族自治州': '楚雄',
    '红河哈尼族彝族自治州': '红河',
    '文山壮族苗族自治州': '文山',
    '西双版纳傣族自治州': '西双版纳',
    '大理白族自治州': '大理',
    '德宏傣族景颇族自治州': '德宏',
    '怒江傈僳族自治州': '怒江',
    '迪庆藏族自治州': '迪庆'
};

export const ATTRIBUTE_LABELS = {
    cropland: '耕地面积',
    forest: '林地面积',
    shrub: '灌木面积',
    grassland: '草地面积',
    water: '水域面积',
    wetland: '湿地面积',
    impervious: '建设用地面积',
    barren: '裸地面积',
    snow_ice: '冰雪面积'
};

/**
 * 转移专题（spatial_*_yunnan_transfer 宽表）使用的地类编码（项目内口径）
 * 说明：该编码与 CLCD_CLASS_MAP(1..9) 不同，此处以转移相关后端工具与宽表字段为准。
 * 适用范围：
 * - /api/clcd/breaks?mode=transfer
 * - /api/clcd/breaks?mode=rate&attr=conversion（内部累加 transfer 宽表列）
 * - /api/analysis/transfer-flow、/api/analysis/spatial-stats 等
 */
export const TRANSFER_CLASS_NAMES = {
    1: '耕地',
    2: '林地',
    3: '草地',
    4: '水体',
    5: '建设用地',
    6: '裸地',
    7: '冰雪',
    8: '湿地'
};

export const TRANSFER_CLASS_OPTIONS = Object.entries(TRANSFER_CLASS_NAMES)
    .map(([value, label]) => ({ label, value: Number(value) }))
    .sort((a, b) => a.value - b.value);

export const TRANSFER_CLASS_TO_LANDUSE_KEY = {
    1: 'cropland',
    2: 'forest',
    3: 'grassland',
    4: 'water',
    5: 'impervious',
    6: 'barren',
    7: 'snow_ice',
    8: 'wetland'
};
