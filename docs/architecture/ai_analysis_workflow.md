# AI 分析流程（V2，现网链路）

> 说明：该流程图用于替换你给出的旧版时序草图。旧版可以保留，建议新增此 V2 文件作为当前实现基线。  
> 编码：UTF-8

```mermaid
sequenceDiagram
    autonumber
    participant User as 用户
    participant Modal as AI 对话窗口<br/>AIAnalysisModal.vue
    participant Service as src/utils/aiService.js
    participant API as POST /api/ai/analyze-stream
    participant Chat as server/routes/ai/chat.js
    participant Mid as aiMiddleware
    participant Agent as ReActAgent(llamaindex)
    participant Tools as agentTools
    participant DB as PostgreSQL/PostGIS
    participant KB as skills/*.md
    participant Ollama as Ollama LLM
    participant MCP as server/mcp/index.js
    participant KG as knowledge_graph.json

    User->>Modal: 输入问题
    Modal->>Service: analyzeDataStream(messages, region, year, model...)
    Service->>API: fetch + SSE 请求
    API->>Chat: 路由到 handleAIStream()

    Chat->>Mid: validateInput(lastUserMsg)
    Mid-->>Chat: safe / offTopic
    Chat->>Mid: buildSystemPrompt(region, year, thinking)
    Mid-->>Chat: systemPrompt

    Chat->>Agent: 创建 ReActAgent(tools, callbackManager)
    Chat->>Ollama: 发起流式推理
    Ollama-->>Agent: token/thinking 流

    Agent->>Tools: 按需调用 clcd_analysis/dashboard_analysis/spatial_stats_analysis/land_transfer_analysis
    Tools->>DB: 查询业务数据
    DB-->>Tools: 返回统计结果
    Tools-->>Agent: 结构化文本结果

    Agent->>Tools: 按需调用 knowledge_base_lookup
    Tools->>KB: 读取专家技能文档
    KB-->>Tools: 专业规则文本
    Tools-->>Agent: 规则补充上下文

    opt 语义图谱增强（独立通道）
        Agent->>MCP: tools/call(knowledge_query)
        MCP->>KG: 读取图谱并 search/traverse/path/resolve
        KG-->>MCP: 节点关系结果
        MCP-->>Agent: 语义检索结果
    end

    Agent-->>Chat: 最终回答 + 工具轨迹
    Chat-->>Service: SSE data: {content|thinking|done|error}
    Service-->>Modal: 实时渲染回复 / 地图命令
    Modal-->>User: 展示分析结论
```

## 旧版与 V2 的关键差异

1. 旧版是 `DataRouter` 直连数据库后再喂给模型；V2 以 `ReActAgent + agentTools` 为主链路，工具在推理过程中按需调用。  
2. 旧版只体现单一 AI 模型流；V2 增加了 `aiMiddleware` 的输入治理与系统提示词构建。  
3. V2 把“专家知识”拆成两类来源：  
   - `knowledge_base_lookup`（`skills/*.md`）  
   - `knowledge_query`（MCP + `knowledge_graph.json`，语义图谱通道）  
4. 前端保持 SSE 实时回流不变，但回流内容包含更明确的工具轨迹和状态提示。  

## 建议

1. 保留旧版流程图作为“历史版本”，新增本文件为“当前版本”。  
2. 如果你要做论文图，建议再配一张“简化版（无代码文件名）”用于正文，“完整版（带文件路径）”放附录。  
