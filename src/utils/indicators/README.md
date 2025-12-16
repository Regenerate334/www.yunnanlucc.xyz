# 国土空间规划监测指标计算工具

## 概述

该目录包含完整的国土空间土地利用规划监测指标计算工具集，基于CLCD数据（1985-2023年）进行多维度分析。

## 模块说明

### 1. [landUseStructure.js](file:///c:/projects/webgis/my_webgis_project/src/utils/indicators/landUseStructure.js)
**土地利用结构指标**

**功能**：
- `calculateStructureIndicators()` - 计算结构指标（总面积、占比、分类）
- `calculatePerCapitaIndicators()` - 计算人均指标
- `calculateDevelopmentIntensity()` - 计算开发强度
- `batchCalculateStructure()` - 批量计算

**应用场景**：分析某年某地的土地利用构成，评估生产-生活-生态空间格局

---

### 2. [landUseChange.js](file:///c:/projects/webgis/my_webgis_project/src/utils/indicators/landUseChange.js)
**土地利用变化指标**

**功能**：
- `calculateDynamicDegree()` - 计算动态度（K值）
- `calculateComprehensiveDynamicDegree()` - 计算综合动态度
- `generateTransferMatrix()` - 生成转移矩阵
- `calculateChangeRate()` - 计算年均变化速率
- `detectChangeHotspots()` - 检测变化热点
- `analyzeTrend()` - 趋势分析（线性回归）

**应用场景**：监测土地利用时空变化，识别变化热点区域，预测未来趋势

---

### 3. [ecologicalIndicators.js](file:///c:/projects/webgis/my_webgis_project/src/utils/indicators/ecologicalIndicators.js)
**生态环境指标**

**功能**：
- `calculateEcologicalSpaceIndicators()` - 计算生态空间指标
- `assessEcologicalRisk()` - 评估生态风险
- `calculateProtectionPerformance()` - 计算保护绩效

**应用场景**：评估生态保护成效，预警生态风险，指导生态红线划定

---

### 4. [intensiveUtilization.js](file:///c:/projects/webgis/my_webgis_project/src/utils/indicators/intensiveUtilization.js)
**集约利用指标**

**功能**：
- `calculateUrbanExpansionIndicators()` - 计算城镇扩张指标
- `calculateUrbanCompactness()` - 计算城市紧凑度
- `calculateLandUseEfficiency()` - 计算土地利用效率
- `calculateUrbanElasticityCoefficient()` - 计算弹性系数
- `comprehensiveIntensiveEvaluation()` - 综合评价

**应用场景**：评估土地集约利用水平，优化城镇空间布局，提高用地效率

---

### 5. [index.js](file:///c:/projects/webgis/my_webgis_project/src/utils/indicators/index.js)
**统一导出接口**

**功能**：
- `calculateAllIndicators()` - 一键计算所有指标
- `generateIndicatorReport()` - 生成文本报告
- 所有模块的重导出

---

## 使用示例

### 示例1：计算单年结构指标

```javascript
import { calculateStructureIndicators } from '@/utils/indicators'
import { loadLandUseConfig, getProvinceDataByYear } from '@/utils/clcdDataLoader'

// 获取数据
const config = await loadLandUseConfig()
const data2023 = await getProvinceDataByYear(2023)

// 计算指标
const indicators = calculateStructureIndicators(data2023, config)

console.log(indicators)
/*
{
  totalArea: 382954.28,
  composition: { cropland: 82124.65, forest: 254119.67, ... },
  proportions: { cropland: 21.44, forest: 66.37, ... },
  categorizedAreas: {
    productionSpace: { cropland: 82124.65, total: 82124.65 },
    livingSpace: { impervious: 323.16, total: 323.16 },
    ecologicalSpace: { forest: 254119.67, ..., total: 268907.84 },
    ...
  },
  metadata: { year: 2023, region: '云南省', level: 'province', unit: 'km²' }
}
*/
```

---

### 示例2：计算变化指标

```javascript
import { calculateDynamicDegree, analyzeTrend } from '@/utils/indicators'
import { loadProvinceData } from '@/utils/clcdDataLoader'

// 获取时间序列数据
const provinceData = await loadProvinceData()

// 计算2000-2023年耕地动态度
const data2000 = provinceData.find(d => d.year === 2000)
const data2023 = provinceData.find(d => d.year === 2023)

const dynamicDegree = calculateDynamicDegree(data2000, data2023, 'cropland')

console.log(dynamicDegree)
/*
{
  landType: 'cropland',
  initialArea: 85234.12,
  finalArea: 82124.65,
  change: -3109.47,
  changeRate: -3.65,
  dynamicDegree: -0.159,
  yearSpan: 23,
  period: '2000-2023',
  unit: '%/year'
}
*/

// 分析耕地长期趋势
const trend = analyzeTrend(provinceData, 'cropland')

console.log(trend)
/*
{
  landType: 'cropland',
  trend: 'decreasing',
  slope: -123.45,  // 年均减少123.45 km²
  intercept: 86000.23,
  rSquared: 0.923,  // 拟合优度
  period: '1985-2023',
  dataPoints: 39,
  prediction: (year) => { ... }  // 预测函数
}
*/

// 预测2030年耕地面积
const predicted2030 = trend.prediction(2030)
console.log(`预测2030年耕地面积: ${predicted2030} km²`)
```

---

### 示例3：生态风险评估

```javascript
import { assessEcologicalRisk } from '@/utils/indicators'

// 评估2010-2020年生态风险
const data2010 = await getProvinceDataByYear(2010)
const data2020 = await getProvinceDataByYear(2020)

const riskAssessment = assessEcologicalRisk(data2010, data2020)

console.log(riskAssessment)
/*
{
  overallRisk: 'medium',
  riskCount: 3,
  risks: [
    {
      type: 'cropland_loss',
      severity: 'medium',
      value: 156.78,
      description: '耕地向建设用地转换'
    },
    {
      type: 'forest_loss',
      severity: 'low',
      value: 45.23,
      description: '森林面积减少'
    },
    ...
  ],
  period: '2010-2020',
  recommendation: '加强耕地保护，严格控制城市扩张；实施退耕还林，加强森林保护'
}
*/
```

---

### 示例4：一键计算所有指标

```javascript
import { calculateAllIndicators } from '@/utils/indicators'
import { loadProvinceData, loadLandUseConfig } from '@/utils/clcdDataLoader'

const data = await loadProvinceData()
const config = await loadLandUseConfig()

// 社会经济数据（可选）
const socioEconomic = {
  gdp: [12000, 15000, 18000, ...],  // 对应年份的GDP（亿元）
  population: 48000000,  // 人口数
  urbanPopulation: 23000000  // 城镇人口
}

// 计算所有指标
const allIndicators = await calculateAllIndicators(data, { config, socioEconomic })

console.log(allIndicators)
/*
{
  metadata: { period: '1985-2023', region: '云南省', ... },
  change: {
    dynamicDegree: { ... },
    comprehensiveDegree: { ... }
  },
  ecological: {
    risk: { ... },
    protection: { ... }
  },
  urban: { ... },
  trends: {
    cropland: { ... },
    forest: { ... },
    grassland: { ... },
    impervious: { ... }
  },
  elasticity: { ... }
}
*/

// 生成报告
import { generateIndicatorReport } from '@/utils/indicators'
const report = generateIndicatorReport(allIndicators)
console.log(report)
```

---

## 指标公式

### 1. 土地利用动态度
```
K = ((Ub - Ua) / Ua) / T × 100%
```
- Ua: 初期面积
- Ub: 末期面积
- T: 时间跨度（年）

### 2. 综合土地利用动态度
```
LC = (Σ ΔLUi-j / 2Σ LUi) × (1/T) × 100%
```

### 3. 建设用地弹性系数
```
E = 建设用地增长率 / GDP增长率
```
- E < 0.3: 优秀（集约利用）
- E > 1.5: 较差（粗放利用）

### 4. 生态用地占比
```
生态用地占比 = (森林+草地+湿地+水体+苔原) / 总面积 × 100%
```

---

## 数据要求

### 输入数据格式
```javascript
{
  year: 2023,
  level: 'province|prefecture|county',
  region_code: '53',
  region_name: '云南省',
  cropland: 82124.65,
  forest: 254119.67,
  grassland: 12251.58,
  shrubland: 31591.48,
  wetland: 1900.93,
  water: 229.57,
  tundra: 408.67,
  impervious: 323.16,
  bareland: 4.57,
  unit: 'km²'
}
```

### 可选社会经济数据
```javascript
{
  gdp: Number,           // GDP（亿元）
  population: Number,    // 总人口
  urbanPopulation: Number // 城镇人口
}
```

---

## 技术栈

- **ES6+** - 现代JavaScript
- **无外部依赖** - 纯JavaScript实现
- **模块化设计** - 便于维护和扩展

---

## 注意事项

1. **数据单位**: 所有面积数据应为km²
2. **时间跨度**: 变化指标至少需要2个时间点数据
3. **社会经济数据**: 可选，但提供后可计算更多指标
4. **转移矩阵**: 当前为简化实现，实际应通过GIS空间叠加分析

---

## 后续扩展

- [ ] 支持更细粒度的转移矩阵（基于GIS数据）
- [ ] 增加空间自相关分析
- [ ] 支持情景模拟和预测
- [ ] 对接SDG指标体系

---

## 参考文献

1. 国土空间规划监测评估预警体系
2. 土地利用变化监测方法
3. 生态保护绩效评估指标
4. 土地集约利用评价标准
