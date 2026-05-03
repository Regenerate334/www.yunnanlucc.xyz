/**
 * 专题监测面板的“指标体系”配置。
 *
 * 约束：
 * - 仅声明项目内真实可追溯的口径（API/字段/算法在代码中存在依据）
 * - 避免引入依赖能源清单 / InVEST 真值输出等外部数据源的口径
 */

export const INDICATOR_SYSTEMS = {
  transfer: {
    title: '指标体系（仅依赖 LUCC 转移结果）',
    items: [
      '转移规模：_transfer_sum (km²)，由 /api/clcd/breaks?mode=transfer 写入物理表并返回统计摘要。',
      '空间分布：分级断点 breaks 用于 WMS SLD 动态阈值渲染（与地图样式一致）。',
      '热点单元：TopN top_units 按转移面积排序，用于专题监测概览。'
    ]
  },

  rate: {
    reclamation: {
      title: '指标体系（仅依赖 LUCC 统计数据）',
      items: [
        '垦殖率：cropland / shape_area，由 /api/clcd/breaks?mode=rate&attr=reclamation 写入 _rate_val。',
        '统计摘要：stats 提供 min/max/avg/count（仅对 _rate_val > 0 的样本统计）。',
        '分级渲染：breaks 作为 WMS SLD 的动态阈值（与地图样式一致）。'
      ]
    },
    conversion: {
      title: '指标体系（仅依赖 LUCC 转移结果）',
      items: [
        '转换率：SUM(transfer_area) / shape_area，由 /api/clcd/breaks?mode=rate&attr=conversion 写入 _rate_val。',
        '方向过滤：仅当同时指定 from_class 与 to_class 时，按“单一流转方向”累加（列名 yXXXX_fromto）。',
        '分级渲染：breaks 作为 WMS SLD 的动态阈值（与地图样式一致）。'
      ]
    }
  },

  spatial_stats: {
    title: '指标体系（仅依赖 LUCC 转移结果）',
    items: [
      '输入数据：/api/analysis/transfer-flow/* 按 period 切片聚合转移面积（字段 transfer_area）。',
      '重心轨迹：turf.centerOfMass(weight=transfer_area) 计算各 period 的加权重心，并按时间连接为轨迹线。',
      '标准差椭圆：turf.standardDeviationalEllipse(weight=transfer_area) 描述空间离散与方向性（点数不足时跳过）。'
    ]
  }
};

export default INDICATOR_SYSTEMS;
