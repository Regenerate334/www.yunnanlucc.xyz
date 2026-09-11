# 云南省土地利用变化监测预警评估平台

![Node.js](https://img.shields.io/badge/Node.js-v18.0+-339933?style=flat-square&logo=nodedotjs)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-009688?style=flat-square&logo=fastapi)
![Vue.js](https://img.shields.io/badge/Vue.js-Latest-4FC08D?style=flat-square&logo=vuedotjs)
![Vite](https://img.shields.io/badge/Vite-Latest-646CFF?style=flat-square&logo=vite)

这是论文《基于WebGIS和GeoAI Agent的土地利用变化智能监测评估系统》的配套实现代码。项目使用 Vue 3 和 Cesium 构建前端，接入 CLCD 土地覆盖数据集（30 m，1985-2023 年），用于云南省土地利用变化的查询、统计、可视化和预警评估。

<div align="center">
  <img src="./docs/assets/readme_banner.png" alt="系统界面" width="960" />
</div>

## 项目概述

- **项目类型**：全栈 WebGIS 应用，包含 GeoAI 分析模块
- **线上地址**：[www.yunnanlucc.xyz](https://www.yunnanlucc.xyz)
- **核心数据**：中国年度土地覆盖数据集（CLCD，30 m 分辨率，1985-2023 年时序数据）
- **空间尺度**：云南省、16 个地级市/自治州、129 个县级行政区及栅格格网
- **AI 架构**：使用 LlamaIndex ReAct Agent 框架和 Model Context Protocol（MCP）协议，接入领域知识图谱、政策规程文献库和空间分析算子，支持自然语言时空查询、趋势推演和决策分析

## 功能概览

系统主要包括以下模块：

- 三维 WebGIS 地图：底图、地形、行政区划和空间量算
- 时序指标看板：土地利用面积、结构占比和变化趋势
- 空间分析：土地利用转移、空间分布、重心迁移和标准差椭圆
- GeoAI Agent：自然语言查询、工具调用、结果汇总和政策资料检索

<div align="center">
  <img src="./docs/assets/workbench_guide_overview.png" alt="工作台界面" width="960" />
</div>

## 系统架构

### 1. 全栈技术架构

系统按数据层、服务层、适配层、可视化层和 GeoAI 层组织，各层通过接口和数据服务连接。

<div align="center">
  <img src="./docs/assets/system_architecture_v5.png" alt="系统总体架构图" width="720" />
</div>

### 2. GeoAI Agent 双轨协同架构

AI 模块将数据计算和知识检索分开处理。MCP 适配层负责封装空间分析算子，知识图谱和政策文献库用于补充领域信息和政策依据。

<div align="center">
  <img src="./docs/assets/ai_architecture_v2.png" alt="GeoAI Agent 架构图" width="720" />
</div>

### 3. 数据感知与推理工作流

用户输入先经过参数解析和语义路由，再由 Prompt 构建和 ReAct Agent 编排工具调用，最后返回统计结果、空间分析结果和相关政策资料。

<div align="center">
  <img src="./docs/assets/ai_workflow_pipeline.png" alt="AI 数据感知与推理工作流" width="960" />
</div>

## 核心功能与界面展示

### 一、三维 WebGIS 交互与空间量算

基于 Cesium 三维地球引擎，支持多源底图切换、地形渲染、省市县行政边界级联定位，以及地表距离和多边形面积量算。

| 三维地表距离测量 | 三维地表面积量算 |
| :---: | :---: |
| <img src="./docs/assets/gis_measure_distance.jpg" alt="距离测量" width="420" /> | <img src="./docs/assets/gis_measure_area.jpg" alt="面积量算" width="420" /> |

### 二、时序演变与多维指标看板

使用 ECharts 展示 1985-2023 年九类土地利用面积变化、结构占比和转入转出情况。

| 地类面积结构玫瑰图与生态雷达图 | 土地利用演变 K 线与均线波动图 |
| :---: | :---: |
| <img src="./docs/assets/chart_structure_rose.jpg" alt="地类结构分析" width="420" /> | <img src="./docs/assets/chart_trend_kline.jpg" alt="土地利用时序演变" width="420" /> |

| 地类时序流转盈亏监测看板 | 说明 |
| :---: | :--- |
| <img src="./docs/assets/chart_profit_loss_dashboard.jpg" alt="时序盈亏监测看板" width="420" /> | 对耕地、林地等地类统计转入量、转出量和净变化，展示不同年份的变化情况。 |

### 三、空间流转与空间统计分析

支持县域和格网尺度的土地利用转移矩阵、垦殖率空间分布、空间重心迁移轨迹以及标准差椭圆（SDE）分析。

| 云南省县域耕地净流失空间分布 | 2023 年云南省县域垦殖率空间分布 |
| :---: | :---: |
| <img src="./docs/assets/map_cropland_net_loss.png" alt="耕地净流失空间分布" width="420" /> | <img src="./docs/assets/map_cultivation_rate_2023.png" alt="2023 年垦殖率分析" width="420" /> |

| 耕地净流出重心迁移时空轨迹 | 标准差椭圆（SDE）空间演变分析 |
| :---: | :---: |
| <img src="./docs/assets/map_spatial_trajectory.png" alt="重心迁移轨迹" width="420" /> | <img src="./docs/assets/map_sde_ellipse.png" alt="标准差椭圆演变" width="420" /> |

### 四、GeoAI Agent 分析与交互

AI 交互模块支持 SSE 流式返回，并在界面中展示参数解析、模型规划、MCP 工具调用、分析结果和政策资料。

<div align="center">
  <img src="./docs/assets/ai_ui_analysis_window.png" alt="AI 分析窗口" width="960" />
</div>

| 参数解析 | 工具规划 |
| :---: | :---: |
| <img src="./docs/assets/ai_ui_parameter_parse.png" alt="AI 参数解析" width="420" /> | <img src="./docs/assets/ai_ui_tool_plan.png" alt="AI 工具规划" width="420" /> |

| 工具调用过程 1 | 工具调用过程 2 |
| :---: | :---: |
| <img src="./docs/assets/ai_ui_tool_call_1.png" alt="AI 工具调用过程 1" width="420" /> | <img src="./docs/assets/ai_ui_tool_call_2.png" alt="AI 工具调用过程 2" width="420" /> |

| 分析结果 | 政策资料检索 |
| :---: | :---: |
| <img src="./docs/assets/ai_ui_agent_result.png" alt="Agent 分析结果" width="420" /> | <img src="./docs/assets/ai_ui_policy_reference.png" alt="政策资料检索结果" width="420" /> |

<div align="center">
  <img src="./docs/assets/ai_ui_integrated_result.png" alt="综合分析结果" width="760" />
</div>

## 技术栈详解

### 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Vue 3** | 3.5.13 | 渐进式前端框架，Composition API |
| **Vite** | 6.3.5 | 构建工具与开发服务器 |
| **Cesium** | 1.130.0 | 三维地球地图引擎与空间图层渲染 |
| **ECharts** | 5.5.0 + echarts-gl | 时序统计图表与三维可视化看板 |
| **Vue Router** | 4.5.1 | 单页应用前端路由 |
| **Pinia** | 2.2.4 | 全局与模块化状态管理 |
| **Turf.js** | 7.2.0 | 前端轻量空间拓扑与距离面积分析 |
| **Tailwind CSS** | 4.1.13 | 响应式样式与原子化 CSS 框架 |
| **KaTeX / markdown-it** | 最新 | 数学公式与 Markdown 流式排版渲染 |
| **RSA + Zod** | 最新 | 登录非对称加密与表单数据校验 |

### 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Node.js + Express** | 4.19.2 | RESTful API 核心服务 |
| **PostgreSQL (PostGIS)** | 8.11.5 | 空间数据库驱动与空间 SQL 引擎 |
| **LlamaIndex** | 0.12.1 | ReAct Agent 编排框架 |
| **MCP SDK** | 1.29.0 | Model Context Protocol 协议适配 |
| **DeepSeek API / Ollama** | V4 / 本地 | 云端与本地多模型推理调度 |
| **Winston** | 3.19.0 | 分级日志记录与轮转 |
| **PM2** | 集成 | 生产环境守护进程与服务管理 |

## 项目结构

```text
my_webgis_project/
├── .env                        # 环境变量配置
├── ecosystem.config.cjs        # PM2 进程管理配置
├── package.json                # 依赖与脚本
├── vite.config.js              # Vite 构建配置
│
├── server/                     # 后端服务
│   ├── index.js                # Express 入口
│   ├── config/                 # 数据库、日志与安全配置
│   ├── routes/                 # API 路由层 (auth, admin, ai, clcd, analysis, common)
│   ├── services/               # 空间分析与业务算法层 (landUseService)
│   ├── knowledge/              # 领域知识库 (skills, corpus, graph, ontology, catalog)
│   ├── mcp/                    # MCP Server 协议适配层 (STDIO 模式)
│   │   ├── index.js            # MCP 服务入口
│   │   ├── resources/          # 知识资源注册
│   │   └── tools/              # 空间分析与知识检索工具
│   └── utils/                  # 工具函数与 AI 核心 (ai/core, tools, dataSources, indices)
│
├── src/                        # 前端应用
│   ├── main.js                 # Vue 应用入口
│   ├── router/                 # 页面路由
│   ├── stores/                 # Pinia 状态管理
│   ├── views/                  # 核心页面 (Portal, Workbench, RegionalAnalysis, Admin, Login)
│   ├── components/             # 组件库 (buttons, cards, charts, controls, dashboards, ui)
│   └── utils/                  # Cesium 工具、AI 流式解析与加密模块
│
├── ops/                        # 运维与评测脚本
│   ├── ai/evaluation/          # GeoAI Agent 72 题定量评价实验套件
│   ├── geo/                    # GeoServer SLD 与比率图层同步
│   └── sys/                    # 数据库状态检查与监控探针
│
├── geoserver_styles/           # GeoServer SLD 地类配图样式
└── docs/                       # 项目文档、算法说明与插图资产
```

## 运行与部署

### 环境要求

- Node.js >= 18.0.0
- PostgreSQL >= 14.0（配置 PostGIS 空间扩展）
- GeoServer（发布 CLCD 栅格 WMS 图层服务）
- DeepSeek API Key（云端推理）或 Ollama（本地推理）

### 常用运行命令

```bash
# 1. 安装依赖
npm install

# 2. 首次数据库与样式初始化
npm run init:db             # 初始化数据库架构
npm run sync:sld            # 同步 GeoServer SLD 样式
npm run sync:rate-layers    # 预计算空间比率图层

# 3. 知识图谱构建
npm run mcp:build           # 构建知识目录与领域知识图谱

# 4. 开发环境启动
npm run dev                 # 同时启动前端 (5174) 与后端 (3000)

# 5. 生产环境管理 (PM2)
npm run start:all           # 启动全套守护进程
npm run status              # 检查服务健康状态
npm run stop:all            # 停止全套进程
```

## 数据来源与致谢

- **CLCD 数据集**：Yang, J., & Huang, X. (2021). The 30 m annual land cover dataset and its dynamics in China from 1990 to 2019. *Earth System Science Data*, 13(8), 3907-3925. https://doi.org/10.5194/essd-13-3907-2021
- **行政区划**：国家基础地理信息中心
- **底图服务**：天地图 / 高德地图

## 附录与相关文档

- [API 规范（OpenAPI）- 交互式文档](https://regenerate334.github.io/www.yunnanlucc.xyz/)
- [评价算法范式说明](./docs/algorithms/LUCC_Algorithms_2021_2026.md)
- [预警方法论](./docs/algorithms/LUCC_warning_method_paper_ready_2026-04-21.md)
- [AI 分析工作流](./docs/architecture/ai_analysis_workflow.md)
- [GeoAI Agent 定量评价套件](./evaluation/README.md)
