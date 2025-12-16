/**
 * 图表相关类型定义
 */

import type { LandUseType } from './landuse'

// ============================================
// ECharts 图表配置
// ============================================

/**
 * 环形图配置
 */
export interface RingChartConfig {
    radius: [string, string];  // 内半径、外半径
    center: [string, string];  // 中心位置
}

/**
 * 折线图配置
 */
export interface LineChartConfig {
    smooth: boolean;
    showSymbol: boolean;
    areaStyle?: any;
}

/**
 * 桑基图配置
 */
export interface SankeyChartConfig {
    nodeWidth: number;
    nodeGap: number;
    layoutIterations: number;
}

// ============================================
// 图表数据格式
// ============================================

/**
 * 饼图数据项
 */
export interface PieChartDataItem {
    name: string;
    value: number;
    itemStyle?: {
        color: string;
    };
}

/**
 * 折线图系列数据
 */
export interface LineSeriesData {
    name: string;
    type: 'line';
    data: number[];
    smooth?: boolean;
    areaStyle?: any;
}

/**
 * 桑基图节点
 */
export interface SankeyNode {
    name: string;
    itemStyle?: {
        color: string;
    };
}

/**
 * 桑基图连线
 */
export interface SankeyLink {
    source: string;
    target: string;
    value: number;
}

// ============================================
// 图表交互事件
// ============================================

/**
 * 图表点击事件数据
 */
export interface ChartClickEvent {
    name: string;
    value: number;
    dataIndex: number;
    seriesIndex: number;
}

/**
 * 雷达图维度
 */
export interface RadarIndicator {
    name: string;
    max: number;
    min?: number;
}

/**
 * KPI卡片数据
 */
export interface KPICardData {
    title: string;
    value: number | string;
    unit: string;
    trend?: 'up' | 'down' | 'stable';
    trendValue?: number;
    status?: 'safe' | 'warning' | 'danger';
    icon?: string;
}

// ============================================
// 图表主题配置
// ============================================

/**
 * 图表颜色配置
 */
export interface ChartThemeColors {
    primary: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
    [key: string]: string;
}

/**
 * 土地利用类型颜色映射
 */
export type LandUseColorMap = Record<LandUseType, string>;
