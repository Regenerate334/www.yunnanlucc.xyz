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
        colors: ['#ffffe5', '#fff7bc', '#fee391', '#fec44f', '#fe9929', '#ec7014', '#cc4c02', '#993404', '#662506', '#401200']
    },
    forest: {
        colors: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b', '#00220e']
    },
    shrub: {
        colors: ['#ffffe5', '#f7fcb9', '#d9f0a3', '#addd8e', '#78c679', '#41ab5d', '#238443', '#006837', '#004529', '#002518']
    },
    grassland: {
        colors: ['#ffffcc', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#253494', '#081d58', '#040e2c', '#020716']
    },
    water: {
        colors: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b', '#041533']
    },
    wetland: {
        colors: ['#f7fcf0', '#e0f3db', '#ccebc5', '#a8ddb5', '#7bccc4', '#4eb3d3', '#2b8cbe', '#0868ac', '#084081', '#042040']
    },
    impervious: {
        colors: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d', '#330006']
    },
    barren: {
        colors: ['#ffffff', '#f0f0f0', '#d9d9d9', '#bdbdbd', '#969696', '#737373', '#525252', '#252525', '#000000', '#000000']
    },
    snow_ice: {
        colors: ['#fff7fb', '#ece7f2', '#d0d1e6', '#a6bddb', '#74a9cf', '#3690c0', '#0570b0', '#045a8d', '#023858', '#011c2c']
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
