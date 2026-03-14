# 云南省国土空间规划监测预警平台 - API 参考文档

版本: 1.0.0 | 基础地址: http://localhost:3000

---

## 认证说明

除 `/api/auth/*`、`/api/weather` 和 `/health` 外，所有接口均需要 JWT 令牌认证。

请求头格式: `Authorization: Bearer {token}`

令牌有效期: 24 小时

---

## 接口列表

### 用户认证

#### POST /api/auth/login

用户登录接口。验证用户名和密码，成功后返回 JWT 令牌。

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| username | string | 是 | 用户名 |
| password | string | 是 | 密码 |

**响应示例**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": 1, "username": "admin", "role": "admin" }
}
```

#### POST /api/auth/register

用户注册接口。创建新用户账号。

| 参数名 | 类型 | 必填 | 验证规则 |
|--------|------|------|----------|
| username | string | 是 | 至少 3 个字符 |
| password | string | 是 | 至少 6 个字符 |

#### GET /api/auth/verify

验证令牌有效性。返回解码后的用户信息。

---

### 土地利用数据

#### GET /api/clcd/years

获取数据集中可用的年份列表。

```json
[1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2023]
```

#### GET /api/clcd/{year}/summary

获取指定年份各土地利用类型的面积汇总。

| 路径参数 | 类型 | 说明 |
|----------|------|------|
| year | number | 目标年份，如 2023 |

```json
[
  { "class_code": 1, "class_name": "Cropland", "area_km2": 57432.15 },
  { "class_code": 2, "class_name": "Forest", "area_km2": 198234.88 }
]
```

#### GET /api/clcd/province

获取省级土地利用时间序列数据（宽表格式）。面积单位为平方米 (m²)。

#### GET /api/clcd/prefecture

获取所有地级市的土地利用数据。

#### GET /api/clcd/county

获取所有区县的土地利用数据。

#### GET /api/clcd/trend/{level}/{name}

获取指定区域的历史变化趋势数据。

| 路径参数 | 类型 | 说明 |
|----------|------|------|
| level | string | 行政级别: prefecture (地级市) 或 county (区县) |
| name | string | 区域名称（需 URL 编码） |

#### GET /api/clcd/prefecture/name/{name}

获取指定地级市的时间序列数据。

#### GET /api/clcd/county/name/{name}

获取指定区县的时间序列数据。

#### GET /api/clcd/county/prefecture/{prefecture}

获取某地级市下属所有区县数据。

#### GET /api/clcd/prefecture/year/{year}

获取指定年份所有地级市数据。

#### GET /api/clcd/county/year/{year}

获取指定年份所有区县数据。

---

### 行政区划

#### GET /api/regions/{level}

获取行政区划列表或层级结构。

| level 值 | 返回内容 |
|----------|----------|
| hierarchy | 省-市-县树形结构 |
| prefecture | 地级市名称数组 |
| county | 区县名称数组 |

---

### 空间分析

#### GET /api/analysis/transfer-matrix/periods

获取土地转移矩阵可用的时间周期列表。

```json
["1990-2000", "2000-2010", "2010-2020", "2020-2023"]
```

#### GET /api/analysis/transfer-matrix/{period}

获取指定时间段的土地利用转移矩阵。

| 路径参数 | 类型 | 说明 |
|----------|------|------|
| period | string | 时间周期，如 2010-2020 |

```json
{
  "absoluteMatrix": [[0, 1234.5, ...], ...],
  "percentageMatrix": [[0, 0.025, ...], ...],
  "landTypes": ["Cropland", "Forest", "Shrub", ...],
  "period": "2010-2020"
}
```

#### GET /api/analysis/dashboard/{year}

获取大屏看板数据，包含省份汇总、动态度排行和预警信息。

| 查询参数 | 类型 | 默认值 | 说明 |
|----------|------|--------|------|
| type | string | comprehensive | 动态度类型: comprehensive, cropland, forest, grassland, impervious, water |

---

### 气象服务

#### GET /api/weather

获取实时天气或天气预报（代理高德天气 API）。无需认证。

| 查询参数 | 类型 | 默认值 | 说明 |
|----------|------|--------|------|
| city | string | 530100 | 城市行政区划代码 |
| extensions | string | base | base (实况) 或 all (预报) |

---

### 智能分析

#### POST /api/ai/analyze-stream

AI 智能分析接口，支持 SSE 流式响应。

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| messages | array | 是 | 对话消息数组 [{role, content}] |
| year | number | 否 | 分析年份，默认 2023 |
| componentContext | object | 否 | 组件上下文 {type: "province_trend"} |
| model | string | 否 | AI 模型，默认 gpt-oss:20b |

**响应格式 (SSE)**

```
data: {"content": "分析结果..."}
data: {"done": true}
```

#### POST /api/report/html

生成高保定 Pro Max 级 HTML 报告接口。

**特性**
- **Hybrid Analysis**: 如果数据上下文长度 > 300 字符，自动触发 Python 深度分析引擎.
- **Evidence-Based**: 报告包含经过 Python 验证的统计证据。
- **Viz-Embedded**: 包含由 Python 引擎生成的专业图表。

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| question | string | 是 | 分析问题 |
| year | number | 否 | 默认 2023 |
| reportTitle | string | 否 | 自定义标题 |
| chatContext | string | 否 | 已有的对话历史 |

#### GET /api/ai/suggestions

获取 AI 建议问题列表。

---

### 会话管理

#### GET /api/chat-sessions

获取当前用户的所有会话列表。

#### POST /api/chat-sessions

创建新的对话会话。

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| title | string | "新对话" | 会话标题 |

#### DELETE /api/chat-sessions/{id}

删除指定会话。

#### GET /api/chat-sessions/{id}/messages

获取指定会话的消息列表。

#### POST /api/chat-sessions/{id}/messages

向会话添加新消息。

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| role | string | 是 | user 或 assistant |
| content | string | 是 | 消息内容 |

---

## 类型定义

### 土地利用类型

| 代码 | 英文名 | 中文名 | 说明 |
|------|--------|--------|------|
| 1 | Cropland | 耕地 | 农业生产用地 |
| 2 | Forest | 林地 | 森林资源 |
| 3 | Shrub | 灌木 | 灌木丛 |
| 4 | Grassland | 草地 | 天然/人工草地 |
| 5 | Water | 水体 | 湖泊、河流 |
| 6 | Snow/Ice | 冰雪 | 永久冰雪覆盖 |
| 7 | Barren | 裸地 | 无植被覆盖 |
| 8 | Impervious | 建设用地 | 不透水面 |
| 9 | Wetland | 湿地 | 湿地生态系统 |

### AI 模型

| 模型 | 参数量 | 说明 |
|------|--------|------|
| gpt-oss:120b-cloud | 120B | 最强推理，建议用于报告生成 |
| gpt-oss:20b | 20B | 默认，性能平衡 |
| deepseek-r1:8b | 8B | 标准模式 |
| gemma3:4b | 4B | 快速模式 |
| deepseek-r1:1.5b | 1.5B | 极速模式 |

### 深度分析引擎 (Python Engine)

| 模块 | 职责 | 实现技术 |
|------|------|----------|
| **CodeGenerator** | 动态编写分析代码 | LangChain + Gemini |
| **CodeExecutor** | 执行 Python 统计环境 | Subprocess + Pandas |
| **CodeFixer** | 自动修复执行错误 | Self-Healing AI |
| **VisionAudit** | 多模态图表审计 | Gemini-1.5-Pro/Flash |

### 云南省地级行政区划

| 名称 | 区划代码 | 名称 | 区划代码 |
|------|----------|------|----------|
| 昆明市 | 530100 | 曲靖市 | 530300 |
| 玉溪市 | 530400 | 保山市 | 530500 |
| 昭通市 | 530600 | 丽江市 | 530700 |
| 普洱市 | 530800 | 临沧市 | 530900 |
| 楚雄彝族自治州 | 532300 | 红河哈尼族彝族自治州 | 532500 |
| 文山壮族苗族自治州 | 532600 | 西双版纳傣族自治州 | 532800 |
| 大理白族自治州 | 532900 | 德宏傣族景颇族自治州 | 533100 |
| 怒江傈僳族自治州 | 533300 | 迪庆藏族自治州 | 533400 |

---

## 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证或令牌无效 |
| 403 | 无权限访问 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 相关文件

- [交互式文档](./index.html)
- [OpenAPI 3.0 规范](./openapi.yaml)
- [Postman 测试集合](./postman_collection.json)

---

## 客户端直出报告引擎 (v2.0)

自 2026-03-14 起，平台引入了全新的**客户端直出报告引擎 (Direct Report Engine)**。

**工作原理**:
- 引擎不再依赖后端 `/api/ai/report/html` 接口。
- 直接利用 `renderMarkdown` 功能在用户的浏览器中将 AI 分析的实时 Markdown 文本转换为结构化 HTML。
- 使用 **Blob URL** 技术生成临时报告页面，支持在 iframe 中即时预览。

**关键优势**:
- **零延迟**: 报告生成时间从秒级降至毫秒级。
- **离线友好**: 只要 AI 回复已完成，即使网络断开也可生成完整报告。
- **隐私保护**: 敏感的分析上下文不再需要二次传输至后端。
- **排版优化**: 针对 A4 打印进行了像素级优化，支持自动导出 PDF 并保留原始对话标题。
