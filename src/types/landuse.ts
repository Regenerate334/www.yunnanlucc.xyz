/**
 * 云南省国土空间规划 - 土地利用专题
 * 核心类型定义
 */

// ============================================
// 枚举定义
// ============================================

/**
 * 土地利用类型（六大类）
 */
export enum LandUseType {
    CROPLAND = '耕地',
    FOREST = '林地',
    GRASSLAND = '草地',
    WATER = '水域',
    CONSTRUCTION = '建设用地',
    UNUSED = '未利用地'
}

/**
 * 行政区划级别
 */
export enum AdminLevel {
    PROVINCE = 'province',
    CITY = 'city',
    COUNTY = 'county'
}

/**
 * 指标状态
 */
export enum IndicatorStatus {
    SAFE = 'safe',
    WARNING = 'warning',
    DANGER = 'danger'
}

// ============================================
// 基础数据结构
// ============================================

/**
 * 省级年度数据
 */
export interface ProvinceYearData {
    year: number;
    [LandUseType.CROPLAND]: number;   // 耕地面积 (km²)
    [LandUseType.FOREST]: number;     // 林地面积 (km²)
    [LandUseType.GRASSLAND]: number;  // 草地面积 (km²)
    [LandUseType.WATER]: number;      // 水域面积 (km²)
    [LandUseType.CONSTRUCTION]: number; // 建设用地面积 (km²)
    [LandUseType.UNUSED]: number;     // 未利用地面积 (km²)
}

/**
 * 地级市年度数据
 */
export interface CityYearData extends ProvinceYearData {
    code: string;      // 行政区划代码，如 "530100"
    name: string;      // 如 "昆明市"
}

/**
 * 县级年度数据
 */
export interface CountyYearData extends CityYearData {
    cityCode: string;  // 所属地级市代码
}

// ============================================
// 行政区划结构
// ============================================

/**
 * 行政区划树节点
 */
export interface AdminTreeNode {
    code: string;
    name: string;
    level: AdminLevel;
    children?: AdminTreeNode[];
}

// ============================================
// 核心指标
// ============================================

/**
 * 耕地红线指标
 */
export interface CroplandRedlineIndicator {
    current: number;         // 当前耕地面积 (km²)
    target: number;          // 红线目标值 (km²) - 云南省2410万亩
    ratio: number;           // 当前/目标比例
    status: IndicatorStatus; // 安全状态
}

/**
 * 土地利用指标集合
 */
export interface LandUseIndicators {
    // === 结构指标 ===
    /** 各地类占比 (%) */
    structureRatios: Record<LandUseType, number>;

    // === 变化指标 ===
    /** 建设用地扩张速度 (km²/年) */
    constructionExpansionRate: number;

    /** 耕地占用率 (%) - 年度耕地减少/上年耕地面积 */
    croplandOccupancyRate: number;

    /** 耕地红线检测 */
    croplandRedline: CroplandRedlineIndicator;

    // === 生态指标 ===
    /** 生态用地占比 (%) - 林地+草地+水域 */
    ecologicalLandRatio: number;

    /** 生态安全 - ≥80% 为安全 */
    ecologicalSafety: boolean;

    // === 综合指标 ===
    /** 土地消耗率与人口增长率比值 (LCRPGR) */
    lcrpgr: number;

    /** 综合动态度 */
    comprehensiveDynamicDegree: number;

    /** 单一动态度 - 各地类的年变化率 */
    singleDynamicDegrees: Record<LandUseType, number>;

    // === 生态服务价值 ===
    /** 生态服务价值 (万元) - 基于谢高地2023年系数 */
    esv: number;
}

// ============================================
// GeoJSON 相关
// ============================================

/**
 * GeoJSON Feature 属性
 */
export interface LandUseFeatureProperties {
    code: string;
    name: string;
    level: AdminLevel;
    data?: CityYearData | CountyYearData | ProvinceYearData;
}

/**
 * Choropleth 着色配置
 */
export interface ChoroplethConfig {
    selectedType: LandUseType;
    year: number;
    colorScale: {
        min: string;    // 最小值颜色 (绿色 - 生态用地)
        mid: string;    // 中间值颜色 (黄色)
        max: string;    // 最大值颜色 (红色 - 建设用地)
    };
}

// ============================================
// 交互状态
// ============================================

/**
 * 对比模式配置
 */
export interface CompareMode {
    enabled: boolean;
    year1: number;
    year2: number;
}

/**
 * 选择状态
 */
export interface SelectionState {
    level: AdminLevel;
    code: string | null;
    year: number;
    selectedLandType: LandUseType;
}

// ============================================
// 图表数据
// ============================================

/**
 * 时间范围
 */
export interface TimeRange {
    start: number;
    end: number;
}

/**
 * 桑基图流动数据
 */
export interface SankeyFlowData {
    source: LandUseType;
    target: LandUseType;
    value: number;  // 转移面积 (km²)
}

/**
 * 地类转移矩阵
 */
export interface TransferMatrix {
    year1: number;
    year2: number;
    flows: SankeyFlowData[];
}

// ============================================
// 云南省人口数据
// ============================================

/**
 * 历年人口数据 (万人)
 */
export interface PopulationData {
    year: number;
    population: number;  // 单位：万人
}

// ============================================
// 生态服务价值系数
// ============================================

/**
 * 谢高地2023年生态服务价值当量表系数
 * 单位：元/hm²·年
 */
export interface ESVCoefficients {
    [LandUseType.CROPLAND]: number;
    [LandUseType.FOREST]: number;
    [LandUseType.GRASSLAND]: number;
    [LandUseType.WATER]: number;
    [LandUseType.CONSTRUCTION]: number;
    [LandUseType.UNUSED]: number;
}

// ============================================
// API 响应类型
// ============================================

/**
 * API 响应包装
 */
export interface APIResponse<T> {
    code: number;
    message: string;
    data: T;
}

/**
 * 加载状态
 */
export interface LoadingState {
    loading: boolean;
    error: Error | null;
    loaded: boolean;
}
