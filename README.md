# 云南国土空间规划监测预警平台

一个基于Vue 3 + Cesium的现代化WebGIS平台，专注于国土空间规划监测预警和空间分析功能。
<img width="2556" height="1227" alt="image" src="https://github.com/user-attachments/assets/247a6808-4dff-45ea-a121-0b735069881a" />

## 🌟 项目特色

- **理论导向**：基于指标体系与方法论的国土空间规划监测
- **数据驱动**：集成多源地理空间数据，支持实时监测预警
- **科技守护**：AI驱动引擎，智慧报告图谱
- **交互体验**：现代化UI设计，流畅的用户交互

## 🚀 核心功能

### 1. 国土空间格局监测
- **格局演变分析**：土地利用变化评价、城镇用地扩张监测
- **功能演变评估**：农业、城镇、生态功能均衡评价
- **实时数据展示**：年度面积变化趋势、地类占比分析

### 2. 空间分析工具
- **航线规划器**：支持多边形绘制和蛇形航线生成
- **空间计算**：基于Turf.js的精确空间分析
- **交互式地图**：3D/2D场景切换，多视角观察

### 3. 数据可视化
- **动态图表**：ECharts集成的趋势分析和饼图展示
- **时间轴控制**：支持历史数据回放和对比分析
- **图例系统**：CLCD土地覆盖分类标准配色

## 🛠️ 技术栈

### 前端框架
- **Vue 3** - 渐进式JavaScript框架
- **Vite** - 下一代前端构建工具
- **Vue Router** - 官方路由管理器

### 地图引擎
- **Cesium** - 3D地球和地图可视化库
- **Cesium Navigation** - 导航控制组件
- **Turf.js** - 空间分析JavaScript库

### 样式与UI
- **Tailwind CSS** - 实用优先的CSS框架
- **自定义组件** - 响应式设计，现代化界面

### 数据服务
- **GeoServer WMS** - 地理空间数据服务
- **GeoJSON** - 矢量数据格式支持

## 📁 项目结构

```
my_webgis_project/
├── public/
│   ├── data/                    # 地理数据文件
│   │   ├── ali_530100_full.json
│   │   ├── yunnan_boundary.geo.json
│   │   └── yunnan_cities_boundary.geo.json
│   └── images/                  # 静态图片资源
├── src/
│   ├── components/              # Vue组件
│   │   ├── front_page.vue       # 主地图页面
│   │   ├── login_page.vue       # 登录首页
│   │   └── PolygonAair.vue      # 航线规划组件
│   ├── router/                  # 路由配置
│   ├── assets/                  # 资源文件
│   └── App.vue                  # 根组件
├── package.json                 # 项目依赖
├── vite.config.js               # Vite配置
└── tailwind.config.js           # Tailwind配置
```

## 🚀 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖
```bash
npm install
```

### 开发环境运行
```bash
npm run dev
```

### 生产环境构建
```bash
npm run build
```

### 预览构建结果
```bash
npm run preview
```

## 🔧 配置说明

### Cesium配置
项目使用Cesium进行3D地图渲染，需要配置访问令牌：

```javascript
Cesium.Ion.defaultAccessToken = 'your-cesium-token';
```

### GeoServer配置
如需使用WMS服务，请确保GeoServer运行在：
```
http://localhost:8080/geoserver/WebGIS/wms
```

## 📊 数据说明

### 支持的数据格式
- **GeoJSON**：矢量边界数据
- **WMS**：栅格影像服务
- **CLCD**：中国土地覆盖数据集

### 数据来源
- 云南省行政区划边界
- 历史土地利用数据（1985-2023）
- 实时监测指标数据

## 🎯 使用指南

### 地图操作
1. **缩放控制**：鼠标滚轮缩放，双击快速定位
2. **视角切换**：支持3D/2D模式切换
3. **图层管理**：通过时间滑块切换不同年份数据

### 航线规划
1. 点击"开始绘制"按钮
2. 在地图上左键添加多边形顶点
3. 右键完成多边形绘制
4. 在多边形边界上选择起点
5. 调整航线间隔和方向参数
6. 生成蛇形航线路径

## 🔮 未来规划

- [ ] 实时数据接入API
- [ ] 更多空间分析算法
- [ ] 移动端适配优化
- [ ] 用户权限管理系统
- [ ] 数据导出功能

---

**数据驱动决策，科技守护未来** 🌍
