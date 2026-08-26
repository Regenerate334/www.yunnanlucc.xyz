<!-- AIAnalysisModal: 智能分析对话弹窗，集成大模型交互、实时状态追踪及报告导出功能 -->
<!--
  @component AIAnalysisModal
  @description AI 智能分析对话框，集成 Markdown 渲染与打字机效果，对业务指标进行专家级解读
  @props visible (是否可见), year (分析年份), region (分析区域), analysisType (分析类型)
  @emits update:visible
  @dependencies aiApi (AI 接口)
-->
<template>
  <Teleport to="body">
    <transition name="modal-fade">
      <div v-if="visible" class="ai-modal-overlay" @click="handleClose"></div>
    </transition>

    <transition name="modal-fade">
      <div v-if="visible" class="ai-modal-container" :class="{ 'is-sidebar-resizing': isSidebarResizing }" @click.stop>
        <div class="sidebar" :style="{ width: `${sidebarWidth}px` }">
            <div class="sidebar-header">
              <button class="new-chat-btn" @click="resetToNewChat">
                <div class="plus-circle">
                  <span class="plus-icon">+</span>
                </div>
                <span class="btn-text">New Chat</span>
              </button>
            </div>
            <div class="history-list">
              <div class="history-group">
                <div class="group-title">Today</div>
                <div v-for="session in sessions" :key="session.id" class="history-item"
                  :class="{ active: currentSessionId === session.id }" @click="selectSession(session.id)"
                  :title="session.title">
                  <div class="item-content">
                    <span class="item-title">{{ session.title || '新对话' }}</span>
                  </div>
                  <button class="delete-session-btn" @click.stop="deleteSession(session.id)" title="删除对话">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div
            class="sidebar-resizer"
            role="separator"
            tabindex="0"
            aria-label="调整会话列表宽度"
            :aria-valuenow="sidebarWidth"
            :aria-valuemin="SIDEBAR_MIN_WIDTH"
            :aria-valuemax="SIDEBAR_MAX_WIDTH"
            @pointerdown.prevent="startSidebarResize"
            @keydown="handleSidebarResizeKeydown"
            @dblclick="resetSidebarWidth"
            title="拖动调整会话列表宽度，双击恢复默认宽度"
          >
            <span aria-hidden="true"></span>
          </div>

          <div class="main-content">
            <div class="ai-modal-header">
              <button class="close-btn" @click="handleClose" title="关闭">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="ai-modal-body" :class="{ 'no-scroll': messages.length === 0 }" ref="messagesContainer" @scroll="handleMessagesScroll">
              <div v-if="messages.length === 0" class="welcome-container">
                <div class="welcome-section">
                  <img src="/assets/ai-plus.svg" class="welcome-logo" alt="" aria-hidden="true">
                  <h1 class="welcome-title">ReAct · GeoAI Agent土地利用智能分析助手</h1>
                  <p class="welcome-subtitle">基于 AI 大模型，为您提供专业的土地利用变化分析与决策支持</p>
                </div>

                <!-- 居中的输入框 -->
                <div class="centered-input-wrapper">
                  <div class="input-pill">
                    <div class="input-area">
                      <textarea v-model="inputText" placeholder="Send a message..." @keydown.enter.prevent="handleEnter"
                        @input="adjustInputHeight" :disabled="loading" rows="1" ref="inputField"></textarea>
                    </div>

                    <div class="input-controls">
                      <div class="model-selector-wrapper">
                        <div class="model-selector-pill" :class="{ disabled: loading, active: showModelDropdown }"
                          @click.stop="toggleModelDropdown">
                          {{ getModelLabel }}
                          <svg class="selector-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </div>
                        <transition name="dropdown-fade">
                          <div v-if="showModelDropdown" 
                            class="model-dropdown-menu" 
                            style="background-color: #0f172a !important; background: #0f172a !important; opacity: 1 !important; visibility: visible !important; backdrop-filter: blur(30px) !important; border: 1px solid rgba(255, 255, 255, 0.1) !important;">
                            <div v-for="model in availableModels" :key="model.value" class="model-dropdown-item"
                              :class="{ active: selectedModel === model.value }" @click.stop="selectModel(model.value)">
                              <div class="model-info">
                                <span class="model-name">{{ model.label }}</span>
                                <span class="model-desc">{{ model.desc }}</span>
                              </div>
                            </div>
                          </div>
                        </transition>
                      </div>

                      <button v-if="loading" class="stop-btn-pill" @click="stopGeneration" title="停止生成">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="5" y="5" width="14" height="14" rx="2" />
                        </svg>
                      </button>
                      <button v-else class="send-btn-pill" @click="sendMessage(inputText)"
                        :disabled="loading || !inputText.trim()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          stroke-width="2">
                          <line x1="12" y1="19" x2="12" y2="5" />
                          <polyline points="5 12 12 5 19 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <div class="questions-scroll-wrapper">
                  <div
                    v-for="(row, rowIndex) in quickQuestionRows"
                    :key="`prompt-row-${rowIndex}`"
                    :class="[
                      'questions-scroll-track',
                      rowIndex % 2 === 0 ? 'scroll-left' : 'scroll-right',
                      `difficulty-${rowIndex + 1}`
                    ]"
                    :aria-label="`预设问题，第 ${rowIndex + 1} 级难度`"
                  >
                    <button
                      v-for="(q, i) in duplicateQuickQuestionRow(row)"
                      :key="`prompt-${rowIndex}-${i}`"
                      class="quick-btn"
                      @click="sendMessage(q)"
                    >
                      {{ q }}
                    </button>
                  </div>
                </div>
              </div>

              <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
                <div class="bubble-wrapper">
                  <div
                    v-if="msg.role === 'assistant' && parseMessage(msg).trace.length === 0 && (parseMessage(msg).thinking || (loading && index === messages.length - 1))"
                    class="thinking-process">
                    <div
                      class="thinking-header"
                      role="button"
                      tabindex="0"
                      @click="toggleThinking(index)"
                      @keydown.enter.stop="toggleThinking(index)"
                      @keydown.space.prevent.stop="toggleThinking(index)"
                      :aria-expanded="expandedThinking[index] === true"
                      :title="expandedThinking[index] === true ? '点击折叠思考过程' : '点击展开思考过程'"
                    >
                      <div class="thinking-title">
                        <!-- 默认显示灯泡 icon -->
                        <svg class="thinking-icon-svg"
                          :class="{ 'is-thinking': loading && index === messages.length - 1 }" width="16" height="16"
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                          stroke-linejoin="round">
                          <path d="M9 18h6"></path>
                          <path d="M10 22h4"></path>
                          <path
                            d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z">
                          </path>
                        </svg>
                        <span v-if="loading && index === messages.length - 1">正在形成分析判断...</span>
                        <span v-else>分析用时 {{ msg.thinkTime || '几' }} 秒</span>

                        <!-- 展开/折叠箭头 -->
                        <svg class="arrow-icon-svg" :class="{ open: expandedThinking[index] === true }" width="16" height="16"
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                          stroke-linejoin="round">
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </div>
                    </div>
                    <div v-if="parseMessage(msg).thinking && expandedThinking[index] === true" class="thinking-content">
                      {{ toBusinessTraceText(parseMessage(msg).thinking) }}
                    </div>
                  </div>

                  <!-- 基于真实 Trace 事件构建三级 GeoAI Agent 执行树 -->
                  <section v-if="msg.role === 'assistant' && parseMessage(msg).trace.length > 0" class="agent-process-panel">
                    <header
                      class="agent-process-header"
                      role="button"
                      tabindex="0"
                      :aria-expanded="isAgentProcessExpanded(index)"
                      @click="toggleAgentProcess(index)"
                      @keydown.enter.prevent="toggleAgentProcess(index)"
                      @keydown.space.prevent="toggleAgentProcess(index)"
                    >
                      <div
                        :key="getAgentProcessDisplayKey(msg, index)"
                        class="agent-process-current-action"
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        <span class="agent-process-mark" :class="{ running: isAgentProcessRunning(index, msg) }" aria-hidden="true">
                          <img :class="getAgentProcessIconClass(msg, index)" :src="getAgentProcessIcon(msg, index)" alt="">
                        </span>
                        <h2
                          class="agent-process-title"
                          :class="{ 'is-running': isAgentProcessRunning(index, msg) }"
                        >{{ getAgentProcessTitle(msg, index) }}</h2>
                        <span v-if="isAgentProcessRunning(index, msg)" class="agent-process-state running">执行中</span>
                        <svg class="agent-process-chevron" :class="{ open: isAgentProcessExpanded(index) }" width="17" height="17"
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
                          stroke-linejoin="round" aria-hidden="true">
                          <polyline points="9 6 15 12 9 18"></polyline>
                        </svg>
                      </div>
                    </header>

                    <div v-if="isAgentProcessExpanded(index)" class="agent-trace-list">
                      <article
                        v-for="(event, traceIndex) in getTraceDisplayItems(msg)"
                        :key="event.id || traceIndex"
                        :class="['agent-trace-event', `phase-${event.phase || 'system'}`, `status-${event.status || 'completed'}`, { 'is-compact': isCompactTraceStage(event), 'is-open': isTraceStageExpanded(index, event) }]"
                      >
                        <div class="agent-trace-rail" aria-hidden="true">
                          <span class="agent-trace-dot">
                            <span v-if="event.status === 'error'" class="agent-trace-error-mark">!</span>
                            <img v-else :class="[getTraceIconClass(event), { 'is-running': event.status === 'running' }]" :src="getTraceIconSource(event)" alt="">
                          </span>
                          <span v-if="traceIndex < getTraceDisplayItems(msg).length - 1" class="agent-trace-line"></span>
                        </div>

                        <div class="agent-trace-stage">
                          <header
                            :class="['agent-trace-stage-header', { 'is-expandable': isTraceStageExpandable(event, index) }]"
                            :role="isTraceStageExpandable(event, index) ? 'button' : undefined"
                            :tabindex="isTraceStageExpandable(event, index) ? 0 : undefined"
                            :aria-expanded="isTraceStageExpandable(event, index) ? isTraceStageExpanded(index, event) : undefined"
                            @click="isTraceStageExpandable(event, index) && toggleTraceStage(index, event)"
                            @keydown.enter.prevent="isTraceStageExpandable(event, index) && toggleTraceStage(index, event)"
                            @keydown.space.prevent="isTraceStageExpandable(event, index) && toggleTraceStage(index, event)"
                          >
                            <div class="agent-trace-stage-heading">
                              <div class="agent-trace-title-row">
                                <h3 class="agent-trace-title">{{ event.title }}</h3>
                                <span v-if="event.status && event.status !== 'completed'" :class="['agent-trace-status', `status-${event.status}`]">
                                  {{ getTraceStatusLabel(event.status) }}
                                </span>
                                <svg v-if="isTraceStageExpandable(event, index)" class="agent-trace-chevron"
                                  :class="{ open: isTraceStageExpanded(index, event) }" width="16" height="16"
                                  viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                                  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                  <polyline points="9 6 15 12 9 18"></polyline>
                                </svg>
                              </div>
                              <p v-if="event.summary" class="agent-trace-summary-text">{{ event.summary }}</p>
                            </div>
                          </header>

                          <div v-if="isTraceStageExpanded(index, event)" class="agent-trace-branch">
                            <div v-if="getTraceDecisionText(event)" class="trace-model-monologue">
                              <span class="trace-model-monologue-icon" aria-hidden="true">
                                <img class="trace-icon-deepseek" :src="traceIconSources.deepseek" alt="">
                              </span>
                              <div class="trace-model-monologue-copy">
                                <span class="trace-model-monologue-label">模型推断</span>
                                <p>{{ getTraceDecisionText(event) }}</p>
                              </div>
                            </div>

                            <div v-if="getTraceDetailItems(event, index).length" class="trace-detail-tree">
                              <section
                                v-for="detail in getTraceDetailItems(event, index)"
                                :key="detail.id"
                                :class="['trace-detail-item', { 'is-open': isTraceDetailExpanded(index, event, detail.id) }]"
                              >
                                <button
                                  type="button"
                                  class="trace-detail-toggle"
                                  :aria-expanded="isTraceDetailExpanded(index, event, detail.id)"
                                  @click="toggleTraceDetail(index, event, detail.id)"
                                >
                                  <span class="trace-detail-icon" aria-hidden="true">
                                    <img :class="getTraceIconClassBySource(detail.icon)" :src="detail.icon" alt="">
                                  </span>
                                  <span class="trace-detail-label">{{ detail.label }}</span>
                                  <span v-if="detail.meta" class="trace-detail-meta">{{ detail.meta }}</span>
                                  <svg class="trace-detail-chevron" :class="{ open: isTraceDetailExpanded(index, event, detail.id) }"
                                    width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <polyline points="9 6 15 12 9 18"></polyline>
                                  </svg>
                                </button>

                                <div v-if="isTraceDetailExpanded(index, event, detail.id)" class="trace-detail-content">
                                  <p v-if="detail.type === 'text'" class="trace-section-text">{{ detail.text }}</p>

                                  <div v-else-if="detail.type === 'tool'" class="trace-tool-row">
                                    <span class="trace-tool-copy">
                                      <strong>通过 MCP 调用</strong>
                                      <code>{{ detail.script }}</code>
                                      <span class="trace-tool-action">{{ detail.action }}</span>
                                    </span>
                                    <span class="trace-tool-source">MCP · {{ detail.tool }}</span>
                                  </div>

                                  <template v-else-if="detail.type === 'parameters'">
                                    <dl class="trace-kv-grid">
                                      <div v-for="entry in getTraceParameterEntries(detail.value)" :key="entry.key" class="trace-kv-item">
                                        <dt class="trace-kv-key">{{ entry.label }}</dt>
                                        <dd class="trace-kv-value">{{ entry.value }}</dd>
                                      </div>
                                    </dl>
                                    <pre v-if="isComplexTraceData(detail.value)" class="trace-code-block">{{ formatTraceData(detail.value) }}</pre>
                                  </template>

                                  <template v-else-if="detail.type === 'result'">
                                    <p v-if="detail.summary" class="trace-section-text trace-observation-summary">{{ detail.summary }}</p>
                                    <pre v-if="detail.content" class="trace-code-block trace-result-block">{{ detail.content }}</pre>
                                  </template>

                                  <p v-else-if="detail.type === 'error'" class="trace-error-text">{{ detail.text }}</p>
                                </div>
                              </section>
                            </div>
                          </div>
                        </div>
                      </article>
                    </div>
                  </section>

                  <!-- 历史消息兼容：没有结构化 trace 时显示旧工作流 -->
                  <div v-else-if="msg.role === 'assistant' && parseMessage(msg).statuses.length > 0" class="industrial-stepper">
                    <div class="workflow-header" @click="toggleWorkflow(index)" role="button" tabindex="0"
                      @keydown.enter.prevent="toggleWorkflow(index)" @keydown.space.prevent="toggleWorkflow(index)"
                      :aria-expanded="expandedWorkflow[index] === true"
                      :title="expandedWorkflow[index] === true ? '点击折叠工作流' : '点击展开工作流'">
                      <span class="workflow-title">分析过程与依据</span>
                      <span class="workflow-subtitle">问题理解与数据证据</span>
                      <span class="workflow-legend" aria-label="分析类型图例">
                        <span class="legend-dot lane-tool">分析工具</span>
                        <span class="legend-dot lane-skill">知识资料</span>
                        <span class="legend-dot lane-knowledge-graph">关系查询</span>
                        <span class="legend-dot lane-policy">政策资料</span>
                      </span>

                      <svg class="workflow-arrow" :class="{ open: expandedWorkflow[index] === true }" width="14" height="14"
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                        stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>

                    <div v-if="expandedWorkflow[index] === true">
                      <div v-for="(status, sIdx) in parseMessage(msg).statuses" :key="sIdx"
                        :class="['step-item', status.type, status.done ? 'done' : 'active', status.lane ? `lane-${status.lane}` : '']">
                        <div class="step-line" v-if="sIdx < parseMessage(msg).statuses.length - 1"></div>
                        <div class="step-indicator">
                          <div class="step-icon" v-html="status.icon"></div>
                          <div class="step-pulse" v-if="!status.done"></div>
                        </div>
                        <div class="step-content">
                          <div class="step-label">{{ getBusinessWorkflowLabel(status.label) }}</div>
                        </div>
                      </div>
                    </div>
                    <div v-else class="workflow-collapsed">
                      已折叠（{{ parseMessage(msg).statuses.length }} 步）
                    </div>
                  </div>

                  <!-- 消息正文 -->
                  <div class="bubble" v-if="parseMessage(msg).content">
                    <div v-if="msg.role === 'assistant'"
                      :class="['markdown-body', { 'is-streaming': loading && index === messages.length - 1 }]"
                      v-html="renderMarkdown(parseMessage(msg).content, loading && index === messages.length - 1)"></div>
                    <div v-else>{{ msg.content }}</div>
                  </div>

                  <!-- 操作按钮 (仅 AI) -->
                  <div v-if="msg.role === 'assistant' && parseMessage(msg).content" class="message-actions">
                    <button class="action-btn" @click="copyMessage(index)" title="复制当前轮次（含问题/回答/工作流）">
                      <svg class="copy-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                    <!-- 生成报告按钮 -->
                    <button
                      class="action-btn report-btn"
                      @click="generateReport(messages.slice(0, index + 1))"
                      :disabled="reportLoading"
                      title="基于此对话生成 PDF 报告"
                    >
                      <svg v-if="!reportLoading" width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10 9 9 9 8 9"/>
                      </svg>
                      <svg v-else class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 底部固定输入区域 (仅在有消息时显示) -->
            <div v-if="messages.length > 0" class="ai-modal-footer">
              <div class="input-pill">
                <div class="input-area">
                  <textarea v-model="inputText" placeholder="Send a message..." @keydown.enter.prevent="handleEnter"
                    @input="adjustInputHeight" :disabled="loading" rows="1" ref="inputField"></textarea>
                </div>

                <div class="input-controls">
                  <div class="model-selector-wrapper">
                    <div class="model-selector-pill" :class="{ disabled: loading, active: showModelDropdown }"
                      @click.stop="toggleModelDropdown">
                      {{ getModelLabel }}
                      <svg class="selector-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                    <transition name="dropdown-fade">
                      <div v-if="showModelDropdown" 
                        class="model-dropdown-menu"
                        style="background-color: #0f172a !important; background: #0f172a !important; opacity: 1 !important; visibility: visible !important; backdrop-filter: blur(30px) !important; border: 1px solid rgba(255, 255, 255, 0.1) !important;">
                        <div v-for="model in availableModels" :key="model.value" class="model-dropdown-item"
                          :class="{ active: selectedModel === model.value }" @click.stop="selectModel(model.value)">
                          <div class="model-info">
                            <span class="model-name">{{ model.label }}</span>
                            <span class="model-desc">{{ model.desc }}</span>
                          </div>
                        </div>
                      </div>
                    </transition>
                  </div>

                  <button v-if="loading" class="stop-btn-pill" @click="stopGeneration" title="停止生成">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="5" y="5" width="14" height="14" rx="2" />
                    </svg>
                  </button>
                  <button v-else class="send-btn-pill" @click="sendMessage(inputText)"
                    :disabled="loading || !inputText.trim()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div class="footer-hint">AI可能会犯错，请核对重要信息。</div>
            </div>
          </div>
        </div> <!-- end .ai-modal-container -->
    </transition>
  </Teleport>

  <!-- 报告预览弹窗 -->
  <Teleport to="body">
    <transition name="report-fade">
      <div v-if="reportVisible" class="report-overlay" @click.self="closeReport">
        <div class="report-modal">
          <!-- 报告弹窗头部 -->
          <div class="report-modal-header">
            <span class="report-modal-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:middle">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              AI 分析报告
            </span>
            <div class="report-header-actions">
              <button class="report-action-btn" @click="printReport" title="打印 / 另存为 PDF">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                打印
              </button>
              <button class="report-action-btn" @click="openReportNewTab" title="在新标签页打开">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                新标签
              </button>
              <button class="report-close-btn" @click="closeReport" title="关闭">×</button>
            </div>
          </div>
          <!-- 报告内容区 -->
          <div class="report-modal-body">
            <div v-if="reportLoading" class="report-loading">
              <div class="report-loading-spinner"></div>
              <p>正在排版报告，请稍候...</p>
            </div>
            <iframe
              v-else-if="reportHtmlUrl"
              ref="reportIframe"
              :src="reportHtmlUrl"
              class="report-iframe"
              sandbox="allow-same-origin allow-scripts"
              frameborder="0"
            />
            <div v-else-if="reportError" class="report-error">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p>{{ reportError }}</p>
              <button class="report-retry-btn" @click="retryReport">重试</button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue';
import { analyzeDataStream, generateQuickQuestionRows } from '@/utils/aiService.js';
import 'highlight.js/styles/atom-one-dark.css';
import 'katex/dist/katex.min.css';
import mermaid from 'mermaid';
import { renderMarkdown } from '@/utils/aiMarkdownRenderer.js';
import { buildDirectReportHtml } from '@/utils/aiReportTemplate.js';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
});

const parseCache = new Map();

const normalizeProtocolGlyphs = (text = '') => String(text || '')
  .replace(/[｜]/g, '|')
  .replace(/[＜]/g, '<')
  .replace(/[＞]/g, '>');

const stripInternalProtocolNoise = (text = '') => {
  let content = normalizeProtocolGlyphs(text);
  const dsmlIndex = content.search(/<\|+\s*DSML/i);
  if (dsmlIndex >= 0) {
    content = content.slice(0, dsmlIndex);
  }
  return content
    .replace(/^\s*\[(SEARCH|ANALYSIS)\].*$/gim, '')
    .replace(/^\s*(Thought|Action Input|Action|Observation)\s*:.*$/gim, '')
    .trim();
};

const stripCopyArtifacts = (text = '') => stripInternalProtocolNoise(text)
  .replace(/\[\[MAP_COMMAND:.*?\]\]/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const _parseMessage = (msg, skipCache = false) => {
  if (!msg) return { thinking: '', content: '', statuses: [], trace: [] };

  let thinking = msg.thinking || '';
  let content = msg.content || '';
  const trace = Array.isArray(msg.trace)
    ? msg.trace.filter((event) => event && typeof event === 'object' && event.id)
    : [];
  const cacheKey = typeof msg === 'string'
    ? msg
    : (msg.content || '') + (msg.thinking || '') + JSON.stringify(msg.workflow || []) + JSON.stringify(trace);

  // 流式输出期间跳过缓存，确保每次 chunk 后都能获取最新解析结果
  if (!skipCache && parseCache.has(cacheKey)) return parseCache.get(cacheKey);

  const statuses = [];
  const icons = {
    brain: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>`,
    tool: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
    code: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
    database: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"></path><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"></path></svg>`,
    radar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M2 12h20"/><circle cx="12" cy="12" r="4"/></svg>`,
    search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    analysis: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`,
    map: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4.5 9.5 2 3 5.5v16l6.5-3.5 5 2.5 6.5-3.5v-16z"></path><path d="M9.5 2v16"></path><path d="M14.5 4.5v16"></path></svg>`,
    check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>`
  };

  const workflowIconMap = {
    brain: icons.brain,
    tool: icons.tool,
    code: icons.code,
    database: icons.database,
    radar: icons.radar,
    search: icons.search,
    analysis: icons.analysis,
    map: icons.map,
    check: icons.check
  };

  const normalizeWhitespace = (text = '') => text.replace(/\s+/g, ' ').trim();
  const summarizeDetail = (text = '', maxLen = 140) => {
    const t = normalizeWhitespace(text);
    if (!t) return '';
    return t.length > maxLen ? `${t.slice(0, maxLen)}...` : t;
  };
  const summarizeTitleDetail = (text = '', maxLen = 38) => {
    const t = normalizeWhitespace(text)
      .replace(/\[\[MAP_COMMAND:.*?\]\]/g, '')
      .replace(/[#*_`>|[\]-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!t) return '';
    return t.length > maxLen ? `${t.slice(0, maxLen)}...` : t;
  };
  const withTitleDetail = (label, detail, maxLen = 38) => {
    const suffix = summarizeTitleDetail(detail, maxLen);
    if (!suffix || label.includes(suffix)) return label;
    return `${label} · ${suffix}`;
  };

  const parseJsonLoose = (text = '') => {
    const raw = text.trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      const jsonLike = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/)?.[0];
      if (!jsonLike) return null;
      try {
        return JSON.parse(jsonLike);
      } catch {
        return null;
      }
    }
  };

  const toolMetaMap = {
    clcd_analysis: {
      name: 'clcdTool',
      start: 'clcdTool → 分析CLCD土地利用数据',
      params: 'dataRouter → 组装 clcdTool 参数',
      done: 'clcdTool → CLCD数据返回成功',
      icon: icons.database
    },
    dashboard_analysis: {
      name: 'dashboardTool',
      start: 'dashboardTool → 汇总综合指标数据',
      params: 'dataRouter → 组装 dashboardTool 参数',
      done: 'dashboardTool → 综合指标返回成功',
      icon: icons.database
    },
    spatial_stats_analysis: {
      name: 'spatialStatsTool',
      start: 'spatialStatsTool → 执行空间统计分析',
      params: 'dataRouter → 组装 spatialStatsTool 参数',
      done: 'spatialStatsTool → 空间统计返回成功',
      icon: icons.radar
    },
    land_transfer_analysis: {
      name: 'transferTool',
      start: 'transferTool → 分析土地利用转移矩阵',
      params: 'dataRouter → 组装 transferTool 参数',
      done: 'transferTool → LUCC转移矩阵返回成功',
      icon: icons.database
    },
    weather_query: {
      name: 'weatherTool',
      start: 'weatherTool → 查询气象观测数据',
      params: 'dataRouter → 组装 weatherTool 参数',
      done: 'weatherTool → 气象观测返回成功',
      icon: icons.search
    },
    knowledge_base_lookup: {
      name: 'knowledgeTool',
      start: 'knowledgeTool → 检索专家知识库',
      params: 'dataRouter → 组装 knowledgeTool 参数',
      done: 'knowledgeTool → 专家知识返回成功',
      icon: icons.search
    },
    knowledge_graph_query: {
      name: 'knowledgeGraphTool',
      start: 'knowledgeGraphTool → 遍历知识图谱网络',
      params: 'dataRouter → 组装 knowledgeGraphTool 参数',
      done: 'knowledgeGraphTool → 图谱实体与关系返回成功',
      icon: icons.search
    },
    policy_reference_lookup: {
      name: 'policyReferenceTool',
      start: 'policyReferenceTool → 检索政策与规划库',
      params: 'dataRouter → 组装 policyReferenceTool 参数',
      done: 'policyReferenceTool → 政策条款数据返回成功',
      icon: icons.search
    },
    web_fetch: {
      name: 'webFetchTool',
      start: 'webFetchTool → 读取权威政策与文献来源',
      params: 'MCP → 传入来源网页 URL',
      done: 'webFetchTool → 网页正文返回成功',
      icon: icons.search
    }
    // map_control 已下线
  };

  const argLabelMap = {
    query_type: '查询类型',
    region: '区域',
    level: '行政级别',
    year: '年份',
    year_range: '年份范围',
    start_year: '起始年份',
    end_year: '结束年份',
    period: '周期',
    land_type: '地类',
    top_n: '数量',
    yearStart: '起始年份',
    yearEnd: '结束年份',
    fromClassStr: '转出地类',
    toClassStr: '转入地类',
    city: '城市',
    skill_name: '知识模块',
    action: '地图动作',
    lnglat: '经纬度',
    zoom: '缩放层级'
  };

  const formatArgs = (value) => {
    const parsed = typeof value === 'string' ? parseJsonLoose(value) : value;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return summarizeDetail(typeof value === 'string' ? value : JSON.stringify(value || ''), 180);
    }
    const pairs = Object.entries(parsed)
      .filter(([, item]) => item !== undefined && item !== null && item !== '')
      .map(([key, item]) => {
        const label = argLabelMap[key] || key;
        const rendered = Array.isArray(item) ? item.join(' - ') : String(item);
        return `${label}: ${rendered}`;
      });
    return pairs.length ? pairs.join('，') : summarizeDetail(JSON.stringify(parsed), 180);
  };

  const inferToolName = (text = '') => {
    const normalized = normalizeWhitespace(text).toLowerCase();
    const direct = normalized.match(/functiontool\s*:\s*(clcd_analysis|dashboard_analysis|spatial_stats_analysis|land_transfer_analysis|weather_query|knowledge_base_lookup)\b|\b(clcd_analysis|dashboard_analysis|spatial_stats_analysis|land_transfer_analysis|weather_query|knowledge_base_lookup)\b/i);
    const directName = direct?.[1] || direct?.[2];
    if (directName) return directName;
    if (/clcd|遥感|土地利用状态|土地利用遥感/.test(normalized)) return 'clcd_analysis';
    if (/仪表盘|综合指标|动态度|预警/.test(normalized)) return 'dashboard_analysis';
    if (/空间重心|椭圆|轨迹|空间统计/.test(normalized)) return 'spatial_stats_analysis';
    if (/转移矩阵|流转|lucc|转化/.test(normalized)) return 'land_transfer_analysis';
    if (/气象|天气|风力|气温/.test(normalized)) return 'weather_query';
    if (/知识库|知识图谱|专家知识|技能|adaptive_analysis|spatial_reasoning|monitoring_indices|policy_expert/.test(normalized)) return 'knowledge_base_lookup';
    return '';
  };

  const resolveThoughtLabel = (detail = '') => {
    const normalized = normalizeWhitespace(detail);
    if (/sql|select|from|where|group by|order by|数据库|查询语句/i.test(normalized)) return 'dataRouter → 规划SQL数据查询';
    if (/意图|用户|问题|需求|asked|request|want|需要/.test(normalized)) return 'AI分析专家 → 解析业务意图';
    if (/工具|调用|tool|function|参数|argument/i.test(normalized)) return 'dataRouter → 选择Agent工具';
    if (/知识库|知识图谱|政策|算法|指标/.test(normalized)) return 'MCP知识服务 → 规划知识检索';
    if (/地图|图层|视角|空间|坐标|区域/.test(normalized)) return 'GeoServer/Cesium → 规划空间联动';
    if (/比较|趋势|变化|转移|占比|排名|分析/.test(normalized)) return 'AI分析专家 → 推导分析方法';
    return 'AI分析专家 → 推理分析路径';
  };

  const inferAnswerTopic = (text = '') => {
    const normalized = normalizeWhitespace(text);
    if (/转移矩阵|流转|转化|转入|转出|LUCC/i.test(normalized)) return '土地利用转移分析';
    if (/动态度|变化率|增速|趋势|多年|时间序列/.test(normalized)) return '土地利用变化趋势分析';
    if (/重心|标准差椭圆|轨迹|方向|迁移/.test(normalized)) return '空间格局演变分析';
    if (/预警|风险|生态|胁迫|保护/.test(normalized)) return '生态风险与预警研判';
    if (/耕地|林地|草地|水域|建设用地|未利用地|湿地/.test(normalized)) return '地类结构分析';
    if (/地图|定位|图层|视角|缩放/.test(normalized)) return '地图联动与空间定位';
    if (/政策|规划|建议|治理|管控/.test(normalized)) return '规划政策建议生成';
    return '综合空间智能分析';
  };

  // map_control 已下线：保留变量占位避免大范围重排（但不会再推入任何地图指令节点）
  let pendingMapStatuses = [];

  const appendAnswerWorkflow = () => {
    if (!content) return;
    const normalized = normalizeWhitespace(content);
    const topic = inferAnswerTopic(content);
    const years = [...new Set((normalized.match(/\b(?:19[8-9]\d|20[0-4]\d)\b/g) || []))].slice(0, 4);
    const regions = [...new Set((normalized.match(/[\u4e00-\u9fa5]{2,14}(?:省|州|市|县|区|自治县|城市群)/g) || []))]
      .filter((item) => !/土地利用|建设用地|政策建议|核心发现|生态风险|分析结果/.test(item))
      .slice(0, 4);
    const landTypes = ['耕地', '林地', '草地', '水域', '湿地', '建设用地', '城乡', '未利用地', '裸地']
      .filter((item) => normalized.includes(item))
      .slice(0, 4);
    const dataHints = [
      /CLCD|遥感|土地利用/.test(normalized) ? 'CLCD土地利用数据' : '',
      /动态度|变化率|趋势|面积|占比|排名/.test(normalized) ? '综合指标数据' : '',
      /转移矩阵|转入|转出|流转|LUCC/i.test(normalized) ? '转移矩阵数据' : '',
      /重心|椭圆|轨迹|空间/.test(normalized) ? '空间统计数据' : '',
      /政策|规划|建议|管控|治理|保护/.test(normalized) ? '政策知识库' : ''
    ].filter(Boolean);
    // map_control 已下线：不再做地图联动/视角控制的 Trace 语义推断
    const needsMapLane = false;
    const needsKnowledgeLane = /政策|规划|建议|治理|管控|保护|知识|算法|指标/.test(normalized);
    const needsRiskLane = /生态|风险|预警|保护|胁迫|压力/.test(normalized);
    const needsChangeLane = /对比|相比|呈现|明显|增加|减少|扩张|收缩|占比|变化|趋势|转化|流转|转移/.test(normalized);

    const labelExists = (pattern) => statuses.some((item) => pattern.test(item.label));
    const pushSemantic = (label, detail, icon = icons.analysis, type = 'analysis', titleMaxLen = 42, insertBeforeMap = true) => {
      if (labelExists(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))) return;
      const statusObj = {
        label,
        type,
        detail,
        icon,
        titleDetail: detail,
        titleMaxLen
      };
      if (!insertBeforeMap) {
        pushStatus(statusObj);
        return;
      }
      pushStatus(statusObj);
    };

    if (!labelExists(/App用户端|提交问题/)) {
      pushSemantic('App用户端 → 提交空间分析问题', topic, icons.brain, 'analysis', 30);
    }
    if (!labelExists(/AI分析专家|解析/)) {
      pushSemantic('AI分析专家 → 解析业务意图', topic, icons.brain, 'analysis', 30);
    }
    if ((regions.length || years.length) && !labelExists(/AI分析专家 → 提取时空约束/)) {
      pushSemantic('AI分析专家 → 提取时空约束', [
        regions.length ? `区域: ${regions.join('、')}` : '',
        years.length ? `年份: ${years.join('、')}` : ''
      ].filter(Boolean).join('，'), icons.map, 'analysis', 54);
    }
    if (!labelExists(/POST接口|SSE流/)) {
      pushSemantic('POST接口 → 建立SSE流式响应', '前端请求进入AI分析接口并持续接收工作流事件', icons.search, 'search', 40);
    }
    if (!labelExists(/AI Middleware|注入/)) {
      pushSemantic('AI Middleware → 注入地图与会话上下文', [
        regions.length ? `区域: ${regions.slice(0, 2).join('、')}` : '',
        years.length ? `年份: ${years.slice(0, 2).join('、')}` : ''
      ].filter(Boolean).join('，') || '加载当前地图、年份与历史会话', icons.map, 'analysis', 46);
    }
    if (!labelExists(/dataRouter|规划工具链/)) {
      pushSemantic('dataRouter → 规划工具链路', dataHints.length ? dataHints.slice(0, 3).join('、') : topic, icons.tool, 'analysis', 44);
    }
    if (dataHints.length && !labelExists(/dataRouter|匹配/)) {
      pushSemantic('dataRouter → 匹配业务分析工具', dataHints.slice(0, 3).join('、'), icons.tool, 'search', 46);
    }
    if (dataHints.some((item) => /CLCD|综合指标|转移矩阵|空间统计/.test(item)) && !labelExists(/PostgreSQL\/PostGIS|读取/)) {
      pushSemantic('PostgreSQL/PostGIS → 读取时空业务数据', dataHints.slice(0, 3).join('、'), icons.database, 'search', 48);
    }
    if (needsKnowledgeLane && !labelExists(/MCP知识服务|专家知识/)) {
      pushSemantic('MCP知识服务 → 检索专家知识图谱', '政策、指标、空间推理与规划建议线索', icons.search, 'search', 46);
    }
    if (landTypes.length && !labelExists(/AgentTools → 提取地类变化信号/)) {
      pushSemantic('AgentTools → 提取地类变化信号', landTypes.join('、'), icons.database, 'analysis', 42);
    }
    if (needsRiskLane && !labelExists(/AI分析专家 → 评估生态风险/)) {
      pushSemantic('AI分析专家 → 评估生态风险与预警因子', '生态、农业、城镇空间压力关系', icons.radar, 'analysis', 44);
    }
    if (needsChangeLane && !labelExists(/AI分析专家 → 归纳空间变化/)) {
      pushSemantic('AI分析专家 → 归纳空间变化特征', summarizeDetail(content, 90), icons.analysis, 'analysis', 42);
    }
    if (/核心发现|发现|建议|应当|需要|可以|因此|表明/.test(normalized) && !labelExists(/Result Aggregator|证据链/)) {
      pushSemantic('Result Aggregator → 汇总发现与证据链', summarizeDetail(content, 90), icons.check, 'analysis', 42);
    }
    // map_control 已下线：不再追加地图联动/指令相关节点
    if (!labelExists(/Ollama|生成/)) {
      pushSemantic('Ollama LLM → 生成专业分析结论', topic, icons.analysis, 'analysis', 36);
    }
    if (!labelExists(/SSE流|回传/)) {
      pushSemantic('SSE流 → 回传答案与工作流状态', '前端实时渲染分析结果和链路节点', icons.check, 'analysis', 42, false);
    }
  };

  let activeToolName = '';

  const classifyLane = (label = '') => {
    const t = String(label || '');
    if (!t) return '';

    // 政策库
    if (/policy_reference|policyReference|政策/i.test(t)) return 'policy';

    // 知识图谱：图谱/graph/ontology 等关键词（与 skill 区分开）
    if (/知识图谱|ontology|graph|knowledge_graph/i.test(t)) return 'knowledge-graph';

    // skill：识别知识库中的分析与方法模块
    if (/knowledge_base_lookup|knowledgeTool|专家知识库/i.test(t) || /adaptive_analysis|policy_expert|monitoring_indices|spatial_reasoning/i.test(t)) {
      return 'skill';
    }

    // tool:
    if (/clcdTool|dashboardTool|spatialStatsTool|transferTool|weatherTool|clcd_analysis|dashboard_analysis|spatial_stats_analysis|land_transfer_analysis|weather_query/i.test(t)) {
      return 'tool';
    }

    // 其余（SSE/接口/LLM/上下文等）统一走默认绿色，不额外上色
    return '';
  };

  const pushStatus = (statusObj) => {
    if (!statusObj?.label) return;
    const prev = statuses[statuses.length - 1];
    const safeDetail = summarizeDetail(statusObj.detail || '', statusObj.maxLen || 160);
    const titleDetail = statusObj.titleDetail === false ? '' : statusObj.titleDetail ?? safeDetail;
    const next = {
      type: statusObj.type || 'analysis',
      done: statusObj.done !== false,
      label: withTitleDetail(statusObj.label, titleDetail, statusObj.titleMaxLen || 38),
      detail: safeDetail,
      icon: statusObj.icon || icons.analysis,
      lane: classifyLane(statusObj.label)
    };
    const prevKey = prev ? `${prev.type}|${prev.label}|${normalizeWhitespace(prev.detail || '')}` : '';
    const nextKey = `${next.type}|${next.label}|${normalizeWhitespace(next.detail || '')}`;
    if (prevKey !== nextKey) {
      statuses.push(next);
    }
  };

  if (Array.isArray(msg.workflow) && msg.workflow.length > 0) {
    msg.workflow.forEach((node, idx) => {
      pushStatus({
        label: node.label,
        type: node.type || 'analysis',
        done: loading.value ? idx < msg.workflow.length - 1 : node.done,
        icon: workflowIconMap[node.iconKey] || icons.analysis,
        detail: '',
        titleDetail: false
      });
    });
  }

  const resolveStatusMeta = (rawTag, detail) => {
    const normalized = normalizeWhitespace(detail || '');
    const inferredToolName = inferToolName(normalized);
    const toolName = inferredToolName || activeToolName;
    const toolMeta = toolMetaMap[toolName];

    if (rawTag === 'THOUGHT') {
      return {
        label: resolveThoughtLabel(normalized),
        type: 'analysis',
        detail: normalized,
        icon: icons.brain,
        maxLen: 180,
        titleMaxLen: 34
      };
    }

    if (rawTag === 'ACTION') {
      activeToolName = inferredToolName || normalized.match(/^([a-z_][a-z0-9_]*)/i)?.[1] || activeToolName;
      const actionTool = toolMetaMap[activeToolName];
      const toolFileMap = {
        'clcd_analysis': 'clcdTool',
        'dashboard_analysis': 'dashboardTool',
        'spatial_stats_analysis': 'spatialStatsTool',
        'land_transfer_analysis': 'transferTool',
        'weather_query': 'weatherTool',
        'knowledge_graph_query': 'knowledgeGraphTool',
        'knowledge_base_lookup': 'knowledgeTool',
        'policy_reference_lookup': 'policyReferenceTool',
        'web_fetch': 'webFetchTool'
      };
      const fallbackName = activeToolName ? (toolFileMap[activeToolName] || `${activeToolName}Tool`) : 'unknownTool';
      return {
        label: actionTool ? actionTool.start : `dataRouter → 调度 ${fallbackName}`.trim(),
        type: 'search',
        detail: normalized,
        icon: actionTool?.icon || icons.tool,
        titleDetail: actionTool ? false : normalized
      };
    }

    if (rawTag === 'ACTION INPUT') {
      const argsTitle = formatArgs(normalized);
      return {
        label: toolMeta?.params || '构造工具调用参数',
        type: 'search',
        detail: argsTitle,
        icon: icons.code,
        maxLen: 220,
        titleDetail: argsTitle,
        titleMaxLen: 52
      };
    }

    if (rawTag === 'OBSERVATION') {
      return {
        label: toolMeta?.done || '数据检索成功',
        type: 'analysis',
        detail: normalized,
        icon: icons.check,
        maxLen: 190,
        titleMaxLen: 36
      };
    }

    if (rawTag === 'SEARCH') {
      if (inferredToolName) activeToolName = inferredToolName;
      if (/挂载|同步地理|地理空间上下文|上下文/i.test(normalized)) {
        return { label: 'AI Middleware → 挂载地理空间上下文', type: 'search', detail: normalized, icon: icons.map, titleDetail: false };
      }
      if (/重试|尝试|链路波动/i.test(normalized)) {
        return { label: 'POST接口 → 重试模型调用链路', type: 'search', detail: normalized, icon: icons.search, titleMaxLen: 28 };
      }
      if (toolMeta) {
        return { label: toolMeta.start, type: 'search', detail: normalized, icon: toolMeta.icon, titleDetail: false };
      }
      if (/sql|查询语句|数据库/i.test(normalized)) {
        return { label: 'dataRouter → 编写并提交SQL查询', type: 'search', detail: normalized, icon: icons.code, titleMaxLen: 34 };
      }
      if (/检索|查询|提取|获取|汇总|执行|同步|分析/i.test(normalized)) {
        return { label: 'dataSourceRegistry.js → 检索时空业务数据', type: 'search', detail: normalized, icon: icons.search, titleMaxLen: 34 };
      }
      return { label: 'POST接口 → 数据链路准备中', type: 'search', detail: normalized, icon: icons.search, titleMaxLen: 30 };
    }

    if (rawTag === 'ANALYSIS') {
      if (/备用模型|切换/i.test(normalized)) {
        return { label: 'Ollama LLM → 切换备用模型继续分析', type: 'analysis', detail: normalized, icon: icons.analysis, titleMaxLen: 30 };
      }
      if (/深入思考|思考|推理|逻辑引擎/i.test(normalized)) {
        return { label: 'Ollama LLM → 解析意图并规划分析路径', type: 'analysis', detail: normalized, icon: icons.brain, titleDetail: false };
      }
      if (/地理数据查询完成|分析链条处理完成|完成|成功|闭环/i.test(normalized)) {
        return { label: toolMeta?.done || '阶段处理完成', type: 'analysis', detail: normalized, icon: icons.check, titleDetail: false };
      }
      return { label: 'Result Aggregator → 组织分析结论', type: 'analysis', detail: normalized, icon: icons.analysis, titleMaxLen: 34 };
    }

    return null;
  };

  const normalizeTagLine = (line) => {
    if (!line) return null;
    const searchMatch = line.match(/^\s*\[(SEARCH|ANALYSIS)\]\s*(.*)$/i);
    if (searchMatch) {
      return { tag: searchMatch[1].toUpperCase(), value: (searchMatch[2] || '').trim() };
    }
    const reactMatch = line.match(/^\s*(Thought|Action Input|Action|Observation|Answer)\s*:\s*(.*)$/i);
    if (reactMatch) {
      return { tag: reactMatch[1].toUpperCase(), value: (reactMatch[2] || '').trim() };
    }
    return null;
  };

  // 1. 按行抽取 trace 块，避免状态文本残留到正文
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const cleanLines = [];
  let activeBlock = null;
  const flushBlock = () => {
    if (!activeBlock) return;
    const detail = activeBlock.lines.join('\n').trim();
    const meta = resolveStatusMeta(activeBlock.tag, detail);
    if (meta) pushStatus(meta);
    activeBlock = null;
  };

  lines.forEach((line) => {
    const tagged = normalizeTagLine(line);
    if (!tagged) {
      if (activeBlock) {
        activeBlock.lines.push(line);
      } else {
        cleanLines.push(line);
      }
      return;
    }

    if (tagged.tag === 'ANSWER') {
      flushBlock();
      if (tagged.value) cleanLines.push(tagged.value);
      return;
    }

    flushBlock();
    activeBlock = { tag: tagged.tag, lines: [] };
    if (tagged.value) activeBlock.lines.push(tagged.value);
  });
  flushBlock();

  content = cleanLines.join('\n').trim();

  // 兜底清理：处理极端流式切片导致的残余 trace 行
  content = content
    .replace(/^\s*\[(SEARCH|ANALYSIS)\].*$/gim, '')
    .replace(/^\s*(Thought|Action Input|Action|Observation)\s*:.*$/gim, '')
    .trim();

  // 保留足够长的可解释链路，避免只剩少量标签
  if (statuses.length > 24) {
    statuses.splice(0, statuses.length - 24);
  }

  // 2. 移除可能的前缀和冗余内部标签
  if (content.startsWith('Answer:')) {
    content = content.replace(/^Answer:\s*/i, '').trim();
  }

  // DeepSeek/某些推理模型可能会把工具协议标记泄露到正文（例如 DSML/tool_calls 块）。
  // 这些内容对用户无意义，还会造成“乱码/协议失败”的观感，直接清理。
  content = stripInternalProtocolNoise(content);
  // map_control 已下线：仅清理历史 MAP_COMMAND 标记，避免污染正文与复制内容
  content = content.replace(/\[\[MAP_COMMAND:.*?\]\]/g, '').trim();

  // 原生 <think> 标签保留原有拦截逻辑（针对如 DeepSeek 等有内置思考块的模型）
  const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
  if (thinkMatch) {
    thinking = (thinking ? thinking + '\n' : '') + thinkMatch[1].trim();
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*/gi, '').trim();
  }

  if (!Array.isArray(msg.workflow) || msg.workflow.length === 0) {
    appendAnswerWorkflow();
  }

  // 3. 步进器动效：如果进行中，仅高亮最后一条；否则全部设为完成态
  statuses.forEach((status, idx) => {
    status.done = (!loading.value) || (idx < statuses.length - 1);
  });

  const result = { thinking, content, statuses, trace };
  if (!skipCache) {
    if (parseCache.size > 100) parseCache.clear();
    parseCache.set(cacheKey, result);
  }
  return result;
};

const props = defineProps({
  visible: { type: Boolean, default: false },
  year: { type: Number, default: 2023 },
  landData: { type: [Object, Array], default: () => ([]) },
  componentContext: { type: Object, default: () => ({}) },
  region: { type: String, default: '云南省' },
  analysisType: { type: String, default: 'default' }
});

const emit = defineEmits(['update:visible', 'close']);

const messages = ref([]);
const inputText = ref('');
const loading = ref(false);
const abortController = ref(null);
const messagesContainer = ref(null);
const inputField = ref(null);
const expandedThinking = ref({});

const SIDEBAR_DEFAULT_WIDTH = 260;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 520;
const SIDEBAR_WIDTH_STORAGE_KEY = 'webgis_ai_sidebar_width';

const clampSidebarWidth = (value) => {
  const numericValue = Number(value);
  const viewportLimit = typeof window === 'undefined'
    ? SIDEBAR_MAX_WIDTH
    : Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, window.innerWidth * 0.45));
  return Math.round(Math.min(viewportLimit, Math.max(SIDEBAR_MIN_WIDTH, numericValue || SIDEBAR_DEFAULT_WIDTH)));
};

const readStoredSidebarWidth = () => {
  try {
    return clampSidebarWidth(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
};

const sidebarWidth = ref(readStoredSidebarWidth());
const isSidebarResizing = ref(false);
let previousBodyCursor = '';
let previousBodyUserSelect = '';

const persistSidebarWidth = () => {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth.value));
  } catch { }
};

const setSidebarWidth = (value, persist = false) => {
  sidebarWidth.value = clampSidebarWidth(value);
  if (persist) persistSidebarWidth();
};

const resizeSidebarFromPointer = (event) => {
  const modal = event.currentTarget?.closest?.('.ai-modal-container') || document.querySelector('.ai-modal-container');
  const rect = modal?.getBoundingClientRect();
  if (!rect) return;
  setSidebarWidth(event.clientX - rect.left);
};

const stopSidebarResize = () => {
  if (!isSidebarResizing.value) return;
  isSidebarResizing.value = false;
  window.removeEventListener('pointermove', resizeSidebarFromPointer);
  window.removeEventListener('pointerup', stopSidebarResize);
  window.removeEventListener('pointercancel', stopSidebarResize);
  document.body.style.cursor = previousBodyCursor;
  document.body.style.userSelect = previousBodyUserSelect;
  persistSidebarWidth();
};

const startSidebarResize = (event) => {
  if (event.button !== 0) return;
  isSidebarResizing.value = true;
  previousBodyCursor = document.body.style.cursor;
  previousBodyUserSelect = document.body.style.userSelect;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  window.addEventListener('pointermove', resizeSidebarFromPointer);
  window.addEventListener('pointerup', stopSidebarResize);
  window.addEventListener('pointercancel', stopSidebarResize);
};

const handleSidebarResizeKeydown = (event) => {
  const step = event.shiftKey ? 32 : 12;
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    setSidebarWidth(sidebarWidth.value - step, true);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    setSidebarWidth(sidebarWidth.value + step, true);
  } else if (event.key === 'Home') {
    event.preventDefault();
    setSidebarWidth(SIDEBAR_MIN_WIDTH, true);
  } else if (event.key === 'End') {
    event.preventDefault();
    setSidebarWidth(SIDEBAR_MAX_WIDTH, true);
  }
};

const resetSidebarWidth = () => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH, true);
const clampSidebarToViewport = () => setSidebarWidth(sidebarWidth.value);

// 会话管理状态
const sessions = ref([]);
const currentSessionId = ref(null);

const SESSION_SCROLL_STORAGE_KEY = 'webgis_ai_session_scroll_positions';
const sessionScrollPositions = (() => {
  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_SCROLL_STORAGE_KEY) || '{}');
    return stored && typeof stored === 'object' ? stored : {};
  } catch {
    return {};
  }
})();
const userIsNearBottom = ref(true);
let scrollPositionTimer = null;

// 仅平滑折叠栏的阅读节奏；完整 Trace 与后端工具链仍按真实速度更新。
const TRACE_HEADLINE_MIN_DURATION_MS = 900;
const TRACE_HEADLINE_PHASES = new Set(['intent', 'decision', 'planning', 'tool_call', 'observation', 'synthesis']);
const TRACE_HEADLINE_EXCLUDED_IDS = new Set(['trace_ingress', 'trace_context', 'trace_delivery']);
const activeTraceEventId = ref('');
const traceHeadlineActive = ref(false);
const traceHeadlineMessageIndex = ref(-1);
const traceHeadlineRequestComplete = ref(false);
const traceHeadlineFinalStatus = ref('completed');
let traceHeadlineQueue = [];
let traceHeadlineSeenIds = new Set();
let traceHeadlineTimer = null;
let traceHeadlineStartedAt = 0;

const clearTraceHeadlineTimer = () => {
  if (!traceHeadlineTimer) return;
  clearTimeout(traceHeadlineTimer);
  traceHeadlineTimer = null;
};

const finishTraceHeadlinePlayback = () => {
  clearTraceHeadlineTimer();
  traceHeadlineQueue = [];
  traceHeadlineActive.value = false;
  activeTraceEventId.value = '';
  traceHeadlineStartedAt = 0;
};

function advanceTraceHeadlineQueue() {
  clearTraceHeadlineTimer();
  const nextItem = traceHeadlineQueue.shift();
  if (nextItem) {
    activateTraceHeadline(nextItem);
    return;
  }
  if (traceHeadlineRequestComplete.value) finishTraceHeadlinePlayback();
}

function activateTraceHeadline(item) {
  if (!item) return;
  clearTraceHeadlineTimer();
  traceHeadlineMessageIndex.value = item.messageIndex;
  activeTraceEventId.value = item.id;
  traceHeadlineActive.value = true;
  traceHeadlineStartedAt = Date.now();
  traceHeadlineTimer = setTimeout(() => {
    traceHeadlineTimer = null;
    advanceTraceHeadlineQueue();
  }, TRACE_HEADLINE_MIN_DURATION_MS);
}

const enqueueTraceHeadline = (event, messageIndex) => {
  const id = String(event?.id || '');
  const phase = String(event?.phase || '');
  if ((traceHeadlineRequestComplete.value && !traceHeadlineActive.value)
    || !id
    || TRACE_HEADLINE_EXCLUDED_IDS.has(id)
    || /^trace_model_/.test(id)
    || !TRACE_HEADLINE_PHASES.has(phase)
    || traceHeadlineSeenIds.has(id)) return;

  traceHeadlineSeenIds.add(id);
  const item = { id, messageIndex };
  if (!traceHeadlineActive.value) {
    activateTraceHeadline(item);
    return;
  }

  const elapsed = Date.now() - traceHeadlineStartedAt;
  if (!traceHeadlineTimer && elapsed >= TRACE_HEADLINE_MIN_DURATION_MS) {
    activateTraceHeadline(item);
    return;
  }
  traceHeadlineQueue.push(item);
};

const completeTraceHeadlinePlayback = (status = 'completed', messageIndex = traceHeadlineMessageIndex.value) => {
  if (messageIndex !== traceHeadlineMessageIndex.value) return;
  traceHeadlineRequestComplete.value = true;
  if (status === 'error'
    || (status === 'stopped' && traceHeadlineFinalStatus.value !== 'error')
    || !['error', 'stopped'].includes(traceHeadlineFinalStatus.value)) {
    traceHeadlineFinalStatus.value = status;
  }

  if (!traceHeadlineActive.value) {
    const nextItem = traceHeadlineQueue.shift();
    if (nextItem) activateTraceHeadline(nextItem);
    else finishTraceHeadlinePlayback();
    return;
  }

  if (!traceHeadlineTimer) {
    const remaining = Math.max(0, TRACE_HEADLINE_MIN_DURATION_MS - (Date.now() - traceHeadlineStartedAt));
    if (remaining === 0) advanceTraceHeadlineQueue();
    else {
      traceHeadlineTimer = setTimeout(() => {
        traceHeadlineTimer = null;
        advanceTraceHeadlineQueue();
      }, remaining);
    }
  }
};

const terminateTraceHeadlinePlayback = (status = 'error', messageIndex = traceHeadlineMessageIndex.value) => {
  if (messageIndex !== traceHeadlineMessageIndex.value) return;
  traceHeadlineRequestComplete.value = true;
  if (status === 'error' || traceHeadlineFinalStatus.value !== 'error') {
    traceHeadlineFinalStatus.value = status;
  }
  finishTraceHeadlinePlayback();
};

const resetTraceHeadlinePlayback = (messageIndex = -1) => {
  clearTraceHeadlineTimer();
  traceHeadlineQueue = [];
  traceHeadlineSeenIds = new Set();
  traceHeadlineStartedAt = 0;
  activeTraceEventId.value = '';
  traceHeadlineActive.value = false;
  traceHeadlineMessageIndex.value = messageIndex;
  traceHeadlineRequestComplete.value = false;
  traceHeadlineFinalStatus.value = 'completed';
};

const persistSessionScrollPositions = () => {
  try {
    localStorage.setItem(SESSION_SCROLL_STORAGE_KEY, JSON.stringify(sessionScrollPositions));
  } catch { }
};

const saveSessionScrollPosition = (sessionId = currentSessionId.value) => {
  const container = messagesContainer.value;
  const numericSessionId = Number(sessionId);
  if (!container || !Number.isFinite(numericSessionId) || numericSessionId <= 0) return;
  sessionScrollPositions[numericSessionId] = Math.max(0, Math.round(container.scrollTop));
  persistSessionScrollPositions();
};

const restoreSessionScrollPosition = async (sessionId = currentSessionId.value) => {
  await nextTick();
  const container = messagesContainer.value;
  if (!container) return;
  const storedPosition = Number(sessionScrollPositions[Number(sessionId)]);
  container.scrollTop = Number.isFinite(storedPosition) ? Math.max(0, storedPosition) : 0;
  const distanceToBottom = container.scrollHeight - container.clientHeight - container.scrollTop;
  userIsNearBottom.value = distanceToBottom <= 96;
};

const handleMessagesScroll = () => {
  const container = messagesContainer.value;
  if (!container) return;
  const distanceToBottom = container.scrollHeight - container.clientHeight - container.scrollTop;
  userIsNearBottom.value = distanceToBottom <= 96;
  if (scrollPositionTimer) clearTimeout(scrollPositionTimer);
  scrollPositionTimer = setTimeout(() => {
    saveSessionScrollPosition();
    scrollPositionTimer = null;
  }, 120);
};

// 会话选择的“标签页级”记忆：
// - 同一 tab 内关闭/打开弹窗：回到上次选中的 session
// - 新开 tab：默认没有该值（天然隔离）
// 说明：sessionStorage 按“tab + origin”隔离，且在 tab 生命周期内跨刷新保留。 (MDN)
const SESSION_STORAGE_KEY = 'webgis_ai_active_session_id';
const readStoredSessionId = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
};
const writeStoredSessionId = (id) => {
  try {
    const v = Number(id);
    if (Number.isFinite(v) && v > 0) sessionStorage.setItem(SESSION_STORAGE_KEY, String(v));
  } catch { }
};

const loadSessions = async () => {
  // console.log('[Sessions] Loading sessions...');
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.error('[Sessions] No auth token found');
      return;
    }
    const response = await fetch('/api/chat-sessions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data.success) {
      sessions.value = data.sessions;
      // console.log('[Sessions] Loaded:', sessions.value.length);
    }
  } catch (err) {
    console.error('[Sessions] Load failed:', err);
  }
};

/**
 * 重置为“临时新对话”状态：仅清空前端 UI，不创建数据库记录。
 * 数据库记录延迟到用户真正发送第一条消息时才创建（惰性创建）。
 */
const resetToNewChat = () => {
  if (abortController.value) stopGeneration();
  resetTraceHeadlinePlayback();
  saveSessionScrollPosition();
  currentSessionId.value = null;
  messages.value = [];
  expandedThinking.value = {};
  expandedWorkflow.value = {};
  expandedAgentProcesses.value = {};
  expandedTraceStages.value = {};
  expandedTraceDetails.value = {};
};

/**
 * 在数据库中创建一条新的 chat session 记录。
 * 仅在用户真正产生交互（发送消息）时调用。
 */
const createNewSession = async () => {
  // console.log('[Sessions] Creating new session...');
  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch('/api/chat-sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title: '新对话' })
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data.success) {
       // console.log('[Sessions] Created:', data.session.id);
      currentSessionId.value = data.session.id;
      writeStoredSessionId(data.session.id);
      await loadSessions();
    }
  } catch (err) {
    console.error('[Sessions] Create failed:', err);
  }
};

const selectSession = async (sessionId) => {
  if (!sessionId) return;
  if (currentSessionId.value === sessionId) return;
  saveSessionScrollPosition();
   // console.log('[Sessions] Selecting session:', sessionId);
  currentSessionId.value = sessionId;
  writeStoredSessionId(sessionId);
  messages.value = [];
  expandedThinking.value = {}; // 清空之前的展开状态，防止索引错乱
  expandedWorkflow.value = {};
  expandedAgentProcesses.value = {};
  expandedTraceStages.value = {};
  expandedTraceDetails.value = {};
  stopGeneration();
  resetTraceHeadlinePlayback();
  loading.value = false;

  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`/api/chat-sessions/${sessionId}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data.success) {
      messages.value = data.messages;
        // console.log('[Sessions] Messages loaded:', messages.value.length);
      // 历史会话默认保持收起，用户点击具体节点后再查看执行细节。
      expandedWorkflow.value = {};
      expandedAgentProcesses.value = {};
      expandedTraceStages.value = {};
      expandedTraceDetails.value = {};
      await restoreSessionScrollPosition(sessionId);
    }
  } catch (err) {
    console.error('[Sessions] Load messages failed:', err);
  }
};

const deleteSession = async (sessionId) => {
  if (!confirm('确定要删除这个对话吗？')) return;
   // console.log('[Sessions] Deleting session:', sessionId);

  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`/api/chat-sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data.success) {
       // console.log('[Sessions] Deleted successfully');
      delete sessionScrollPositions[Number(sessionId)];
      persistSessionScrollPositions();
      await loadSessions();

      // 若删除的是“当前会话”，也同步清理 tab 内记忆，避免下次打开指向不存在的会话
      try {
        const storedId = readStoredSessionId();
        if (Number(storedId) === Number(sessionId)) sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } catch { }

      if (currentSessionId.value === sessionId) {
        if (sessions.value.length > 0) {
          await selectSession(sessions.value[0].id);
        } else {
          resetToNewChat();
        }
      }
    }
  } catch (err) {
    console.error('[Sessions] Delete failed:', err);
  }
};

const saveMessage = async (role, content, thinking = '', thinkTime = 0, workflow = [], trace = []) => {
  if (!currentSessionId.value) return;
  try {
    await fetch(`/api/chat-sessions/${currentSessionId.value}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: JSON.stringify({ role, content, thinking, thinkTime, workflow, trace })
    });
  } catch (err) {
    console.error('保存消息失败:', err);
  }
};

// 深度思考配置（自动识别）
// 说明：后端已支持 DeepSeek 官方接口的 thinking/reasoning_content 流式透传。
// 这里尽量覆盖“默认可用推理模式”的模型，避免用户选了云端模型却未开启思考。
const THINKING_MODELS = ['deepseek-v4', 'deepseek-r1', 'gpt-oss:120b', 'gpt-oss:20b', 'r1'];
const isReasoningModel = computed(() => {
  return THINKING_MODELS.some(m => selectedModel.value.toLowerCase().includes(m));
});

// 默认策略：只要是推理模型（含 deepseek-v4* / r1*），就开启 thinking；
// 其他模型保持关闭，减少无意义的额外 token 与延迟。
const deepThinking = computed(() => isReasoningModel.value);

// 模型选择
const selectedModel = ref('deepseek-v4-pro');
const showModelDropdown = ref(false);
const availableModels = [
  { value: 'deepseek-v4-pro', label: 'DeepSeek-V4 Pro', desc: '官方云端旗舰模型 · 最强推理能力' },
  { value: 'deepseek-r1:8b', label: 'DeepSeek-R1 8B', desc: '标准模式 · 性能平衡' },
  { value: 'gemma4:e4b', label: 'Gemma 4', desc: '快速模式 · 响应灵敏' }
];

const getModelLabel = computed(() => {
  const model = availableModels.find(m => m.value === selectedModel.value);
  return model ? model.label : selectedModel.value;
});

const toggleModelDropdown = () => {
  if (loading.value) return;
  showModelDropdown.value = !showModelDropdown.value;
};

const selectModel = (modelValue) => {
  selectedModel.value = modelValue;
  showModelDropdown.value = false;
};

const handleClickOutside = (e) => {
  if (!e.target.closest('.model-selector-wrapper')) {
    showModelDropdown.value = false;
  }
};

onMounted(() => {
  window.addEventListener('click', handleClickOutside);
  window.addEventListener('resize', clampSidebarToViewport);
});

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', clampSidebarToViewport);
  stopSidebarResize();
  if (scrollPositionTimer) clearTimeout(scrollPositionTimer);
  saveSessionScrollPosition();
  // 组件卸载时取消正在进行的请求
  if (abortController.value) {
    // console.log('[AI Modal] 组件卸载，取消正在进行的请求');
    abortController.value.abort();
    abortController.value = null;
  }
  resetTraceHeadlinePlayback();
});

const quickQuestionRows = computed(() => {
  return generateQuickQuestionRows(props.analysisType, {
    region: props.region,
    year: props.year
  });
});

const duplicateQuickQuestionRow = (row = []) => [...row, ...row];

watch(() => props.visible, async (visible) => {
  if (visible) {
    await loadSessions();

    // 打开弹窗时，不再自动创建数据库记录。
    // 期望行为（与主流 AI 产品一致）：
    // 1) 同一 tab：优先回到上次选中的会话（sessionStorage 记忆）
    // 2) 新 tab / 首次打开 / 无历史会话：停留在欢迎页（临时新对话状态），
    //    只有用户发送第一条消息时才创建数据库记录（惰性创建）
    if (!currentSessionId.value) {
      const storedId = readStoredSessionId();
      const hasStored = storedId && sessions.value.some(s => Number(s?.id) === Number(storedId));
      if (hasStored) {
        await selectSession(storedId);
      } else {
        resetToNewChat();
      }
    }

    await restoreSessionScrollPosition();
    nextTick(() => {
      inputField.value?.focus();
    });
  } else {
    saveSessionScrollPosition();
    if (abortController.value) {
      abortController.value.abort();
      abortController.value = null;
      loading.value = false;
    }
    resetTraceHeadlinePlayback();
  }
});

const handleClose = () => {
  // console.log('[AI Modal] 关闭对话框');
  // 关闭时取消正在进行的请求
  if (abortController.value) {
    // console.log('[AI Modal] 关闭时取消正在进行的请求');
    abortController.value.abort();
    abortController.value = null;
    loading.value = false;
  }
  resetTraceHeadlinePlayback();
  emit('update:visible', false);
  emit('close');
};

const handleEnter = (e) => {
  if (!e.shiftKey) {
    sendMessage(inputText.value);
  }
};

/**
 * 动态调整输入框高度
 */
const adjustInputHeight = () => {
  nextTick(() => {
    const el = inputField.value;
    if (el) {
      el.style.height = 'auto';
      // 这里的 1.5 * 15 是 line-height * font-size
      el.style.height = (el.scrollHeight) + 'px';
    }
  });
};

function stopGeneration() {
  if (abortController.value) {
    // console.log('[AI Modal] 用户点击停止生成');
    abortController.value.abort();
    abortController.value = null;
    loading.value = false;
    terminateTraceHeadlinePlayback('stopped');
  }
}

const clearMessages = () => {
  resetToNewChat();
};

const userInteractedThinking = ref(false); // 追踪用户是否手动调整过折叠状态
const expandedWorkflow = ref({}); // 每条 assistant 消息的“数据工作流”折叠状态（true=展开）
const expandedAgentProcesses = ref({}); // GeoAI 工作流根节点，默认收起
const expandedTraceStages = ref({}); // 业务阶段，默认收起
const expandedTraceDetails = ref({}); // 参数、工具与结果等第三级明细，默认收起

const sendMessage = async (text) => {
  if (!text || !text.trim() || loading.value) return;

  const userMessage = text.trim();
  inputText.value = '';
  nextTick(() => adjustInputHeight()); // 发送后重置高度

  messages.value.push({
    role: 'user',
    content: userMessage
  });

  // 移除前端手动更新标题的逻辑，完全交给后端 AI 处理
  userIsNearBottom.value = true;
  await scrollToBottom(true);
  loading.value = true;
  abortController.value = new AbortController();

  const assistantMsgIndex = messages.value.length;
  resetTraceHeadlinePlayback(assistantMsgIndex);
  const startTime = Date.now();
  messages.value.push({
    role: 'assistant',
    content: '',
    thinking: '',
    thinkTime: 0,
    workflow: [],
    trace: []
  });

  // 初始默认折叠（透明但不打扰阅读）
  expandedThinking.value[assistantMsgIndex] = false;
  expandedWorkflow.value[assistantMsgIndex] = false;
  expandedAgentProcesses.value[assistantMsgIndex] = false;
  userInteractedThinking.value = false; 

  try {
    // 惰性创建：首条消息时才真正在数据库创建 session
    if (!currentSessionId.value) {
      await createNewSession();
    }
    // 发送前保存用户消息
    await saveMessage('user', userMessage);

    // 调试: 打印传递给AI的数据
    /*
    console.log('[AI Modal] 传递的数据:', {
      year: props.year,
      region: props.region,
      contextType: props.componentContext?.type,
      landDataType: Array.isArray(props.landData) ? 'Array' : typeof props.landData,
      landDataLength: Array.isArray(props.landData) ? props.landData.length : Object.keys(props.landData).length
    });
    */

    await analyzeDataStream(
      {
        messages: messages.value.slice(0, -1),
        year: props.year,
        landData: props.landData,
        componentContext: props.componentContext,
        region: props.region,
        deepThinking: deepThinking.value,
        model: selectedModel.value,
        sessionId: currentSessionId.value
      },
      (chunkObj) => {
        if (chunkObj.trace) {
          const trace = messages.value[assistantMsgIndex].trace || [];
          const id = chunkObj.trace.id;
          const traceIndex = trace.findIndex((event) => event?.id === id);
          if (traceIndex >= 0) {
            const next = [...trace];
            next[traceIndex] = { ...next[traceIndex], ...chunkObj.trace };
            messages.value[assistantMsgIndex].trace = next;
          } else {
            const next = [...trace];
            const intentIndex = id === 'trace_context'
              ? next.findIndex((event) => event?.id === 'trace_intent')
              : -1;
            if (intentIndex >= 0) next.splice(intentIndex, 0, chunkObj.trace);
            else next.push(chunkObj.trace);
            messages.value[assistantMsgIndex].trace = next;
          }
          enqueueTraceHeadline(chunkObj.trace, assistantMsgIndex);
        }
        if (chunkObj.workflow) {
          const wf = messages.value[assistantMsgIndex].workflow || [];
          const id = chunkObj.workflow.id;
          if (id) {
            const idx = wf.findIndex((item) => item?.id === id);
            if (idx >= 0) {
              // Upsert: keep a single node per workflow id, update fields (e.g., done flips false->true)
              const next = [...wf];
              next[idx] = { ...next[idx], ...chunkObj.workflow };
              messages.value[assistantMsgIndex].workflow = next;
            } else {
              messages.value[assistantMsgIndex].workflow = [...wf, chunkObj.workflow];
            }
          } else {
            // Fallback (should be rare): append only if not identical to the last node
            const prev = wf[wf.length - 1];
            const prevKey = prev ? `${prev.type}|${prev.label}` : '';
            const nextKey = `${chunkObj.workflow.type}|${chunkObj.workflow.label}`;
            if (prevKey !== nextKey) {
              messages.value[assistantMsgIndex].workflow = [...wf, chunkObj.workflow];
            }
          }
        }
        if (chunkObj.content) {
          messages.value[assistantMsgIndex].content += chunkObj.content;
          // 只有用户没动过，我们才根据全量内容实时控制展开
          const fullContent = messages.value[assistantMsgIndex].content;
          const hasThinking = fullContent.includes('<think>') || fullContent.includes('Thought:') || fullContent.includes('Action:');
          // 默认折叠：仅在用户未干预且当前还没显式设定时才自动展开
          if (hasThinking && !userInteractedThinking.value && expandedThinking.value[assistantMsgIndex] === undefined) {
            expandedThinking.value[assistantMsgIndex] = false;
          }
        }
        if (chunkObj.thinking) {
          messages.value[assistantMsgIndex].thinking += chunkObj.thinking;
          // 收到推理分块时也保持默认折叠，除非用户手动展开
          if (!userInteractedThinking.value && expandedThinking.value[assistantMsgIndex] === undefined) {
            expandedThinking.value[assistantMsgIndex] = false;
          }
        }

        const parsed = parseMessage(messages.value[assistantMsgIndex]);
        // 只有当存在真正的回答正文（非 [SEARCH]/[ANALYSIS] 标签）时，才锁定耗时统计
        const hasRealContent = parsed.content.replace(/\[SEARCH\].*?(\n|$)|\[ANALYSIS\].*?(\n|$)/g, '').trim().length > 0;
        if (hasRealContent && !messages.value[assistantMsgIndex].thinkTime) {
          messages.value[assistantMsgIndex].thinkTime = ((Date.now() - startTime) / 1000).toFixed(1);
        }

        scrollToBottom();
      },
      async () => {
        loading.value = false;
        abortController.value = null;
        completeTraceHeadlinePlayback('completed', assistantMsgIndex);
        
        const lastMsg = messages.value[assistantMsgIndex];
        // 如果结束还没统计到时间（可能是极短的回答或只有状态标签），则补全总耗时
        if (!lastMsg.thinkTime) {
          lastMsg.thinkTime = ((Date.now() - startTime) / 1000).toFixed(1);
        }
        const parsed = parseMessage(lastMsg);
        
        // 如果回复为空，提供友好提示
        if (!parsed.content && !parsed.thinking) {
          lastMsg.content = "> 模型响应结束，但未产生有效内容。这可能是由于：\n1. 上下文窗口超限\n2. AI 模型运行异常\n3. 系统提示词过长导致小模型无法理解\n\n建议尝试切换更强的模型（如 DeepSeek-R1 8B）或刷新重试。";
        }

        // map_control 已下线：不再解析/下发 MAP_COMMAND 地图指令

        // 完成后保存 AI 消息 (持久化所有逻辑字段)
        await saveMessage(
          'assistant',
          lastMsg.content,
          lastMsg.thinking,
          lastMsg.thinkTime,
          lastMsg.workflow || [],
          lastMsg.trace || []
        );
        
        // 延迟 2 秒刷新会话列表，确保后端 AI 已完成标题生成
        setTimeout(() => {
          loadSessions();
        }, 2000);
        scrollToBottom();
      },
      (error) => {
        if (error !== 'The user aborted a request.') {
          messages.value[assistantMsgIndex].content = `分析失败: ${error}`;
        }
        loading.value = false;
        abortController.value = null;
        terminateTraceHeadlinePlayback('error', assistantMsgIndex);
      },
      abortController.value.signal
    );
  } catch (err) {
    loading.value = false;
    abortController.value = null;
    terminateTraceHeadlinePlayback('error', assistantMsgIndex);
  }
  await scrollToBottom();
};

const lastScrollTime = ref(0);
const scrollToBottom = async (force = false) => {
  const now = Date.now();
  if (!force && !userIsNearBottom.value) return;
  if (!force && now - lastScrollTime.value < 100) return;

  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    userIsNearBottom.value = true;
    lastScrollTime.value = now;
  }
};



const toggleThinking = (index) => {
  expandedThinking.value[index] = expandedThinking.value[index] !== true;
  
  // 如果是当前正在生成的 AI 消息，记录用户交互
  if (loading.value && index === messages.value.length - 1) {
    userInteractedThinking.value = true;
  }
};

const toggleWorkflow = (index) => {
  expandedWorkflow.value[index] = expandedWorkflow.value[index] !== true;
};

const getTraceStageKey = (messageIndex, event = {}) => `${messageIndex}:${String(event.id || 'stage')}`;
const getTraceDetailKey = (messageIndex, event = {}, detailId = '') => `${getTraceStageKey(messageIndex, event)}:${detailId}`;

const isAgentProcessExpanded = (messageIndex) => expandedAgentProcesses.value[messageIndex] === true;

const toggleAgentProcess = (messageIndex) => {
  expandedAgentProcesses.value[messageIndex] = !isAgentProcessExpanded(messageIndex);
};

const isTraceStageExpanded = (messageIndex, event = {}) => (
  expandedTraceStages.value[getTraceStageKey(messageIndex, event)] === true
);

const toggleTraceStage = (messageIndex, event = {}) => {
  const key = getTraceStageKey(messageIndex, event);
  expandedTraceStages.value[key] = !isTraceStageExpanded(messageIndex, event);
};

const isTraceDetailExpanded = (messageIndex, event = {}, detailId = '') => (
  expandedTraceDetails.value[getTraceDetailKey(messageIndex, event, detailId)] === true
);

const toggleTraceDetail = (messageIndex, event = {}, detailId = '') => {
  const key = getTraceDetailKey(messageIndex, event, detailId);
  expandedTraceDetails.value[key] = !isTraceDetailExpanded(messageIndex, event, detailId);
};

const traceToolMeta = {
  clcd_analysis: { script: 'clcdTool', label: '土地利用数据分析', action: '分析 CLCD 土地利用数据', result: 'CLCD 土地利用统计结果' },
  dashboard_analysis: { script: 'dashboardTool', label: '综合指标评估', action: '计算 LUCC 监测预警指标', result: 'LUCC 监测预警指标结果' },
  spatial_stats_analysis: { script: 'spatialStatsTool', label: '空间统计分析', action: '计算县域空间分异与格局特征', result: '县域空间统计结果' },
  land_transfer_analysis: { script: 'transferTool', label: '土地利用转移分析', action: '计算土地利用转移矩阵', result: '土地利用转移矩阵' },
  weather_query: { script: 'weatherTool', label: '气象数据查询', action: '查询区域气象数据', result: '区域气象数据' },
  knowledge_base_lookup: { script: 'knowledgeTool', label: '专业知识检索', action: '检索专业知识依据', result: '专业知识条目' },
  knowledge_graph_query: { script: 'knowledgeGraphTool', label: '知识图谱查询', action: '查询知识图谱关系', result: '知识图谱关系结果' },
  knowledge_query: { script: 'knowledgeGraphTool', label: '知识图谱查询', action: '查询知识图谱关系', result: '知识图谱关系结果' },
  policy_reference_lookup: { script: 'policyReferenceTool', label: '政策规划资料检索', action: '检索政策与规划资料', result: '政策与规划文献条目' },
  web_fetch: { script: 'webFetchTool', label: '权威网页资料读取', action: '读取权威网页正文', result: '网页正文内容' }
};

const traceIconSources = {
  agent: '/assets/agent-trace/agent.svg',
  context: '/assets/agent-trace/context.svg',
  nlp: '/assets/agent-trace/advanced-nlp.svg',
  reasoning: '/assets/agent-trace/reasoning.svg',
  deepseek: '/assets/agent-trace/deepseek.svg',
  parameters: '/assets/agent-trace/parameters.svg',
  js: '/assets/agent-trace/js.svg',
  tool: '/assets/agent-trace/tool.svg',
  data: '/assets/agent-trace/data.svg',
  policy: '/assets/agent-trace/policy.svg',
  time: '/assets/agent-trace/time.svg'
};

const knowledgeTraceTools = new Set([
  'knowledge_query',
  'knowledge_base_lookup',
  'knowledge_graph_query',
  'policy_reference_lookup',
  'web_fetch'
]);

const getTraceToolMeta = (tool = '') => traceToolMeta[String(tool)] || {
  script: String(tool || 'analysisTool'),
  label: '空间分析工具',
  action: '执行空间分析',
  result: '空间分析结果'
};

const getTraceToolScript = (tool = '') => getTraceToolMeta(tool).script;
const getTraceToolLabel = (tool = '') => getTraceToolMeta(tool).label;
const getTraceToolAction = (tool = '') => getTraceToolMeta(tool).action;
const getTraceToolResult = (tool = '') => getTraceToolMeta(tool).result;
const isKnowledgeTraceTool = (tool = '') => knowledgeTraceTools.has(String(tool || ''));
const getTraceToolStageIconName = (event = {}) => {
  if (isKnowledgeTraceTool(event.tool)) return 'policy';
  if (event.phase === 'observation') return 'data';
  if (event.phase === 'tool_call') return 'js';
  return 'tool';
};
const getTraceObservationLabel = (event = {}) => (
  isKnowledgeTraceTool(event.tool) ? '返回模型的知识资料' : '返回模型的数据'
);
const getTraceObservationIconSource = (event = {}) => (
  traceIconSources[getTraceToolStageIconName({ ...event, phase: 'observation' })] || traceIconSources.data
);

const getTraceObservationSummary = (observation = {}) => {
  return toBusinessTraceText(observation?.summary || '已获得数据结果。');
};

// 只转换界面文案，不改动 Trace 事件本身。
const toBusinessTraceText = (value = '') => String(value || '')
  .replace(/\n?\[\u6a21\u578b\u63a8\u7406\u8bb0\u5f55\u5df2\u6309\u5b89\u5168\u8fb9\u754c\u622a\u65ad\]/g, '')
  .replace(/DeepSeek(?:\s+Tool\s+Router)?/gi, '分析模型')
  .replace(/Ollama\s*LLM/gi, '分析模型')
  .replace(/MCP\s*Client/gi, 'MCP 知识服务')
  .replace(/Agent\s*Tool/gi, '空间分析工具')
  .replace(/AI\s*Middleware/gi, '地理空间上下文')
  .replace(/SSE(?:\s*Result\s*Aggregator|流)?/gi, '实时响应')
  .replace(/Agent\s*Observation/gi, '工具结果')
  .replace(/Observation/gi, '工具结果')
  .replace(/reasoning_content/gi, '决策依据')
  .replace(/结果已作为下一轮上下文回传给分析模型/gi, '该结果将用于后续路径判断')
  .replace(/回灌(?:给)?(?:分析)?模型/gi, '用于后续分析')
  .replace(/回灌/gi, '用于后续分析')
  .replace(/执行工具|工具调用/gi, '数据分析')
  .replace(/POST\s*\/[^\s，。]*/gi, '分析请求')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const getTraceBusinessTitle = (event = {}) => {
  const id = String(event.id || '');
  if (id === 'trace_ingress') return '接收分析任务';
  if (id === 'trace_context') return '建立时空分析语境';
  if (id === 'trace_intent' || event.phase === 'intent') return '识别分析意图并提取关键参数';
  if (event.phase === 'decision') {
    return toBusinessTraceText(event.title)
      || `模型分析与决策 · 第 ${Number(event.round || 0) + 1} 轮`;
  }
  if (event.phase === 'planning') {
    return `模型分析与决策 · 第 ${Number(event.round || 0) + 1} 轮`;
  }
  if (event.phase === 'tool_call') {
    return `通过 MCP 调用 ${getTraceToolScript(event.tool)} ${getTraceToolAction(event.tool)}`;
  }
  if (event.phase === 'observation') {
    return `接收 ${getTraceToolScript(event.tool)} 返回的${getTraceToolResult(event.tool)}`;
  }
  if (event.phase === 'synthesis') return '综合分析结果并形成解释';
  if (id === 'trace_delivery') return '归档本轮分析结果';
  if (id === 'trace_error') return '复核异常分析过程';
  return toBusinessTraceText(event.title || '分析阶段');
};

const getTraceStageSummary = (event = {}) => {
  const id = String(event.id || '');
  const parameters = event.parameters || {};
  if (id === 'trace_ingress') return '已接收空间分析问题并建立实时响应。';
  if (id === 'trace_context') {
    const backendSummary = toBusinessTraceText(event.summary || '');
    if (backendSummary) return backendSummary;
    const yearRange = Array.isArray(parameters.year_range) && parameters.year_range.length >= 2
      ? `${parameters.year_range[0]}—${parameters.year_range[1]}年`
      : '';
    const years = !yearRange && Array.isArray(parameters.years) && parameters.years.length
      ? `${parameters.years.join('、')}年`
      : '';
    const year = !yearRange && !years && parameters.year ? `${parameters.year}年` : '';
    const scope = [parameters.region, yearRange || years || year].filter(Boolean).join('、');
    return scope ? `已将${scope}纳入本轮分析范围。` : '';
  }
  if (id === 'trace_delivery') return '分析结论与执行记录已归入当前对话。';
  if (event.status === 'error') return toBusinessTraceText(event.summary);
  if (event.phase === 'tool_call') {
    return event.status === 'running'
      ? `MCP 脚本 ${getTraceToolScript(event.tool)} 正在${getTraceToolAction(event.tool)}。`
      : `MCP 脚本 ${getTraceToolScript(event.tool)} 已完成${getTraceToolAction(event.tool)}。`;
  }
  if (event.phase === 'observation' && event.observation) {
    return getTraceObservationSummary(event.observation);
  }
  return toBusinessTraceText(event.summary || '');
};

const getTraceDisplayItems = (msg) => {
  const trace = Array.isArray(msg?.trace) ? msg.trace : [];
  return trace
    .filter((event) => {
      if (!event?.id || /^trace_model_/.test(String(event.id))) return false;
      if (String(event.id) !== 'trace_context') return true;
      return ['question', 'tool', 'question+tool'].includes(String(event.scope_source || ''));
    })
    .map((event) => ({
      ...event,
      title: getTraceBusinessTitle(event),
      summary: getTraceStageSummary(event),
      detail: toBusinessTraceText(event.detail),
      reasoning: toBusinessTraceText(event.reasoning),
      error: toBusinessTraceText(event.error)
    }));
};

const getLatestTraceEvent = (msg) => {
  const trace = getTraceDisplayItems(msg);
  return trace[trace.length - 1] || null;
};

const getAgentProcessActiveEvent = (msg, messageIndex) => {
  if (!traceHeadlineActive.value || messageIndex !== traceHeadlineMessageIndex.value) return null;
  const trace = getTraceDisplayItems(msg);
  if (!trace.length) return null;
  return trace.find((event) => String(event.id) === activeTraceEventId.value)
    || trace[trace.length - 1];
};

const getAgentProcessTitle = (msg, messageIndex) => {
  if (messageIndex === traceHeadlineMessageIndex.value) {
    const activeEvent = getAgentProcessActiveEvent(msg, messageIndex);
    if (activeEvent) return activeEvent.title;
    if (!traceHeadlineRequestComplete.value && loading.value) return '接收分析任务';
    if (traceHeadlineFinalStatus.value === 'error') return 'GeoAI Agent · ReAct Workflow 执行异常';
    if (traceHeadlineFinalStatus.value === 'stopped') return 'GeoAI Agent · ReAct Workflow 执行已停止';
    if (traceHeadlineRequestComplete.value) return 'GeoAI Agent · ReAct Workflow 执行结束';
  }

  const latestEvent = getLatestTraceEvent(msg);
  return latestEvent?.status === 'error' || latestEvent?.id === 'trace_error'
    ? 'GeoAI Agent · ReAct Workflow 执行异常'
    : 'GeoAI Agent · ReAct Workflow 执行结束';
};

const getAgentProcessIcon = (msg, messageIndex) => {
  const event = getAgentProcessActiveEvent(msg, messageIndex);
  if (event) return getTraceIconSource(event);
  if (messageIndex === traceHeadlineMessageIndex.value && ['error', 'stopped'].includes(traceHeadlineFinalStatus.value)) {
    return traceIconSources.time;
  }
  return traceIconSources.agent;
};

const getAgentProcessIconClass = (msg, messageIndex) => {
  const event = getAgentProcessActiveEvent(msg, messageIndex);
  if (event) return getTraceIconClass(event);
  if (messageIndex === traceHeadlineMessageIndex.value && ['error', 'stopped'].includes(traceHeadlineFinalStatus.value)) {
    return 'trace-icon-time';
  }
  return 'trace-icon-agent';
};

const getAgentProcessDisplayKey = (msg, messageIndex) => {
  const event = getAgentProcessActiveEvent(msg, messageIndex);
  return event
    ? `${messageIndex}:${event.id || event.phase || 'trace'}`
    : getAgentProcessTitle(msg, messageIndex);
};

const isAgentProcessRunning = (messageIndex, msg) => (
  ((loading.value && messageIndex === messages.value.length - 1)
    || (traceHeadlineActive.value && messageIndex === traceHeadlineMessageIndex.value))
  && Boolean(msg)
);

const getTraceIconName = (event = {}) => {
  const id = String(event.id || '');
  if (id === 'trace_ingress' || id === 'trace_delivery') return 'agent';
  if (id === 'trace_context') return 'context';
  if (event.phase === 'intent') return 'nlp';
  if (event.phase === 'decision' || event.phase === 'planning') return 'reasoning';
  if (event.phase === 'tool_call' || event.phase === 'observation') return getTraceToolStageIconName(event);
  if (event.phase === 'synthesis') return 'reasoning';
  return 'time';
};

const getTraceIconSource = (event = {}) => traceIconSources[getTraceIconName(event)] || traceIconSources.time;
const getTraceIconClass = (event = {}) => `trace-icon-${getTraceIconName(event)}`;
const getTraceIconClassBySource = (source = '') => {
  const iconName = Object.entries(traceIconSources).find(([, iconSource]) => iconSource === source)?.[0] || 'time';
  return `trace-icon-${iconName}`;
};

const isCompactTraceStage = (event = {}) => ['trace_ingress', 'trace_context', 'trace_delivery']
  .includes(String(event.id || ''));

const getTraceUserQuestion = (event = {}, messageIndex) => {
  if (String(event.id || '') !== 'trace_intent') return '';
  const parameterQuestion = event.parameters?.question;
  if (parameterQuestion) return String(parameterQuestion);
  for (let index = Number(messageIndex) - 1; index >= 0; index -= 1) {
    if (messages.value[index]?.role === 'user') return String(messages.value[index].content || '').trim();
  }
  return '';
};

const getTraceDecisionText = (event = {}) => {
  if (event.phase === 'observation' || event.phase === 'tool_call' || event.phase === 'system') return '';
  const text = toBusinessTraceText(event.reasoning || event.detail);
  return text && text !== event.summary ? text : '';
};

const getTraceFollowUpText = (event = {}) => {
  if (event.phase !== 'observation') return '';
  return toBusinessTraceText(event.detail)
    || '该结果已进入模型上下文，用于下一阶段的路径判断与结论生成。';
};

const getTraceToolSource = (event = {}) => /MCP/i.test(String(event.source || '')) ? 'MCP 知识服务' : '';

const tracePrivateFieldPattern = /(authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|cookie)/i;

const sanitizeTraceData = (value, depth = 0) => {
  if (depth > 6) return '...';
  if (Array.isArray(value)) return value.map((item) => sanitizeTraceData(item, depth + 1));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    tracePrivateFieldPattern.test(key) ? '***' : sanitizeTraceData(item, depth + 1)
  ]));
};

const formatTraceData = (value) => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return JSON.stringify(sanitizeTraceData(parsed), null, 2);
  } catch {
    return String(value || '');
  }
};

const getTraceStatusLabel = (status = 'completed') => ({
  running: '进行中',
  completed: '已完成',
  error: '需复核'
}[status] || '已记录');

const traceParameterLabels = {
  region: '区域',
  year: '年份',
  year_range: '年份范围',
  start_year: '起始年份',
  end_year: '结束年份',
  question: '分析问题',
  calls: '分析路径',
  analysis_tools: '分析方法',
  model: '分析模型',
  provider: '服务类型',
  thinking_enabled: '推理模式',
  history_messages: '参考对话',
  level: '行政层级',
  unit: '统计单元',
  land_type: '地类',
  top_n: '返回数量',
  method: '计算方法',
  mode: '分析模式'
};

const formatTraceValue = (value) => {
  if (value === null || value === undefined || value === '') return '未指定';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) {
    return value.every((item) => ['string', 'number', 'boolean'].includes(typeof item))
      ? value.join('、')
      : `${value.length} 项`;
  }
  if (typeof value === 'object') return `${Object.keys(value).length} 个字段`;
  return String(value);
};

const getTraceParameterEntries = (value) => {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { parsed = value; }
  }
  parsed = sanitizeTraceData(parsed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return [{ key: 'value', label: '内容', value: formatTraceValue(parsed) }];
  }
  return Object.entries(parsed).map(([key, item]) => ({
    key,
    label: traceParameterLabels[key] || key,
    value: formatTraceValue(item)
  }));
};

const isComplexTraceData = (value) => {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { return false; }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return Array.isArray(parsed);
  const entries = Object.entries(parsed);
  return entries.length > 4 || entries.some(([, item]) => item && typeof item === 'object');
};

const shouldShowTraceParameters = (event = {}) => {
  if (isCompactTraceStage(event) || !event.parameters) return false;
  if (!['intent', 'decision', 'planning', 'tool_call'].includes(event.phase)) return false;
  return typeof event.parameters !== 'object' || Object.keys(event.parameters).length > 0;
};

const getTraceParameterLabel = (event = {}) => {
  if (event.phase === 'intent') return '提取参数';
  if (event.phase === 'decision') return '模型选择的工具路径';
  if (event.phase === 'planning') return '规划的工具路径';
  if (event.phase === 'tool_call') return '调用参数';
  return '分析参数';
};

const getTraceObservationContent = (observation = {}) => {
  const content = String(observation?.preview || '').trim();
  if (!content) return '';
  return content
    .replace(/\n?\.\.\. \[OBSERVATION_TRUNCATED \d+ CHARS\]/g, '\n...')
    .replace(/\n?\.\.\. \[OBSERVATION_STRUCTURE_TRUNCATED\]/g, '\n...')
    .replace(/\[REDACTED\]/g, '***')
    .trim();
};

const getTraceDetailItems = (event = {}, messageIndex) => {
  const details = [];
  const question = getTraceUserQuestion(event, messageIndex);

  if (question) {
    details.push({
      id: 'question',
      label: '模型接收到的问题',
      type: 'text',
      text: question,
      icon: traceIconSources.nlp
    });
  }

  if (event.phase === 'tool_call' && event.tool) {
    details.push({
      id: 'tool',
      label: '调用 MCP 脚本',
      type: 'tool',
      tool: String(event.tool),
      script: getTraceToolScript(event.tool),
      toolLabel: getTraceToolLabel(event.tool),
      action: getTraceToolAction(event.tool),
      source: getTraceToolSource(event),
      icon: traceIconSources.js
    });
  }

  if (shouldShowTraceParameters(event)) {
    details.push({
      id: 'parameters',
      label: getTraceParameterLabel(event),
      type: 'parameters',
      value: event.parameters,
      icon: event.phase === 'tool_call'
        ? traceIconSources.parameters
        : (['decision', 'planning'].includes(event.phase) ? traceIconSources.tool : traceIconSources.parameters)
    });
  }

  if (event.observation) {
    details.push({
      id: 'result',
      label: getTraceObservationLabel(event),
      type: 'result',
      summary: getTraceObservationSummary(event.observation),
      content: getTraceObservationContent(event.observation),
      icon: getTraceObservationIconSource(event)
    });
  }

  const followUp = getTraceFollowUpText(event);
  if (followUp) {
    details.push({
      id: 'follow-up',
      label: '后续分析依据',
      type: 'text',
      text: followUp,
      icon: traceIconSources.reasoning
    });
  }

  if (event.error) {
    details.push({
      id: 'error',
      label: '异常信息',
      type: 'error',
      text: event.error,
      icon: traceIconSources.time
    });
  }

  return details;
};

const isTraceStageExpandable = (event = {}, messageIndex) => {
  if (isCompactTraceStage(event)) return false;
  return Boolean(getTraceDecisionText(event) || getTraceDetailItems(event, messageIndex).length);
};

const getBusinessWorkflowLabel = (label = '') => {
  const text = String(label || '');
  if (/App用户端|提交空间分析问题/.test(text)) return '问题理解';
  if (/POST接口|建立SSE|重试模型调用链路|数据链路准备/.test(text)) return '建立分析连接';
  if (/AI Middleware|挂载地理空间上下文|注入地图/.test(text)) return '确定分析范围';
  if (/dataRouter|规划工具链|匹配业务分析工具|调度/.test(text)) return '规划分析路径';
  if (/PostgreSQL|PostGIS|读取时空业务数据/.test(text)) return '获取空间数据';
  if (/MCP知识服务|专家知识|知识图谱/.test(text)) return '补充知识资料';
  if (/Ollama|DeepSeek|生成专业分析结论|解析意图/.test(text)) return '形成分析判断';
  if (/Result Aggregator|汇总发现|证据链/.test(text)) return '整理分析结论';
  if (/SSE流|回传答案|工作流状态/.test(text)) return '输出分析结果';
  return toBusinessTraceText(text)
    .replace(/\s*[→➜]\s*/g, ' · ')
    .replace(/\.js/g, '')
    .trim();
};

// 智能包装：当消息正在流式生成时（当前回答的最后一条），自动跳过缓存
const parseMessage = (msg) => {
  // 正在生成的 assistant 消息 = messages 数组最后一条 + loading 中
  const isStreaming = loading.value && msg === messages.value[messages.value.length - 1];
  return _parseMessage(msg, isStreaming);
};
const copyMessage = (assistantIndex) => {
  const idx = Number(assistantIndex);
  if (!Number.isFinite(idx) || idx < 0 || idx >= messages.value.length) return;

  const assistantMsg = messages.value[idx];
  if (!assistantMsg || assistantMsg.role !== 'assistant') return;

  // 兜底清理：避免协议标记/内部 trace 进入剪贴板（UI 渲染会清理，但这里再防一层）
  const cleanForCopy = (text) => stripCopyArtifacts(text);

  const getWorkflowLinesForCopy = (msg, parsed) => {
    const trace = getTraceDisplayItems(msg);
    const linesFromTrace = trace
      .map((event) => {
        const phase = getTraceBusinessTitle(event || {});
        const tool = event?.tool ? ` · ${event.tool}` : '';
        const summary = String(event?.summary || '').trim();
        return `${phase}${tool}${summary ? `：${summary}` : ''}`;
      })
      .filter(Boolean);
    if (linesFromTrace.length) return linesFromTrace;

    // 优先使用 workflow（结构化节点，通常比 parseMessage.statuses 更完整）
    const nodes = Array.isArray(msg?.workflow) ? msg.workflow : [];
    const linesFromWorkflow = nodes
      .map((n) => String(n?.label || '').trim())
      .filter(Boolean);
    if (linesFromWorkflow.length) return linesFromWorkflow;

    // 兜底：与 UI 渲染保持一致，取 parseMessage 的 statuses
    return Array.isArray(parsed?.statuses)
      ? parsed.statuses
          .map((s) => String(s?.label || '').trim())
          .filter(Boolean)
      : [];
  };

  const writeClipboardWithFallback = async (text) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { }

    // Fallback: execCommand('copy')（兼容部分浏览器/权限策略）
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return !!ok;
    } catch {
      return false;
    }
  };

  // 仅复制当前对话轮次；过程记录只复制阶段摘要，不把展开内容带入正文。
  const parts = [];

  // 1) 最近一条用户问题（向上回溯）
  let questionText = '';
  for (let i = idx - 1; i >= 0; i -= 1) {
    const m = messages.value[i];
    if (m?.role === 'user') {
      questionText = cleanForCopy(String(m.content || '').trim());
      break;
    }
  }
  if (questionText) parts.push(`用户问题：\n${questionText}`);

  // 2) 当前回答的工作流与答案
  const parsed = parseMessage(assistantMsg);
  const workflowLines = getWorkflowLinesForCopy(assistantMsg, parsed)
    .map(cleanForCopy)
    .filter(Boolean);
  if (workflowLines.length) {
    parts.push(`分析过程摘要：\n- ${workflowLines.join('\n- ')}`);
  }

  const answerText = cleanForCopy(parsed.content || assistantMsg.content || '');
  if (answerText) parts.push(`AI回答：\n${answerText}`);

  const finalText = parts.join('\n\n').trim();
  if (!finalText) return;

  writeClipboardWithFallback(finalText).then((ok) => {
    if (ok) alert('内容已复制到剪贴板');
    else alert('复制失败：当前环境不允许写入剪贴板。');
  });
};

watch(messages, (newMsgs) => {
  if (newMsgs.length > 0) {
    const lastIndex = newMsgs.length - 1;
    const lastMsg = newMsgs[lastIndex];
    if (lastMsg.role === 'assistant' && parseMessage(lastMsg).thinking && expandedThinking.value[lastIndex] === undefined) {
      expandedThinking.value[lastIndex] = false;
    }
  }
  nextTick(async () => {
    // 逐个渲染 Mermaid 图表，失败时优雅降级为代码块
    const container = messagesContainer.value;
    if (!container) return;
    const elements = container.querySelectorAll('.mermaid:not([data-mermaid-done])');
    for (const el of elements) {
      const source = el.textContent.trim();
      if (!source) continue;
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        const { svg } = await mermaid.render(id, source);
        el.innerHTML = svg;
        el.setAttribute('data-mermaid-done', 'true');
      } catch (e) {
        // 渲染失败：降级为代码块展示原始 Mermaid 语法
        const escaped = source.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        el.innerHTML = `<pre class="hljs" style="margin:0;border-radius:6px;"><code style="color:#94a3b8;font-size:13px;">/* Mermaid 语法暂不支持此图表类型 */\n${escaped}</code></pre>`;
        el.setAttribute('data-mermaid-done', 'true');
      }
    }
  });
}, { deep: true });

// ── 报告生成逻辑（纯前端，无二次AI调用）─────────────────────────────────────

const reportVisible  = ref(false);
const reportLoading  = ref(false);
const reportHtmlUrl  = ref('');   // Blob URL
const reportError    = ref('');
const reportIframe   = ref(null);
const lastReportMsgSlice = ref(null);

/**
 * 核心：直接从已有AI对话提取内容生成报告，无需二次调用AI。
 * @param {Array} msgSlice - 截至当前消息的对话记录
 */
const generateReport = (msgSlice) => {
  const lastUserMsg      = [...msgSlice].reverse().find(m => m.role === 'user');
  const lastAssistantMsg = [...msgSlice].reverse().find(m => m.role === 'assistant');

  if (!lastUserMsg || !lastAssistantMsg) return;

  // 内容：AI 回复的纯 Markdown（去掉 <think> 思考块）
  const markdownContent = parseMessage(lastAssistantMsg).content;

  // 标题处理逻辑：优先使用 AI 回复中的“第一个 Markdown 标题”（h1/h2/h3），
  // 这样报告标题会更像“2005年云南省各地类面积统计”，而不是把用户提问整句当标题。
  let title = '';
  try {
    const html = renderMarkdown(markdownContent || '');
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const h = doc.querySelector('h1, h2, h3');
    const extracted = h?.textContent?.replace(/\s+/g, ' ').trim();
    if (extracted) title = extracted;
  } catch {
    // ignore
  }
  if (!title) {
    const headingMatch = String(markdownContent || '').match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/m);
    if (headingMatch && headingMatch[1]) title = headingMatch[1].replace(/\s+/g, ' ').trim();
  }
  if (!title) {
    // 兜底逻辑：取用户问题前 40 字
    const q = String(lastUserMsg.content || '').trim();
    title = q.slice(0, 40) + (q.length > 40 ? '...' : '');
  }

  lastReportMsgSlice.value = msgSlice;
  reportVisible.value = true;
  reportLoading.value = true;
  reportError.value   = '';

  // 清除旧 Blob URL
  if (reportHtmlUrl.value) {
    URL.revokeObjectURL(reportHtmlUrl.value);
    reportHtmlUrl.value = '';
  }

  try {
    const bodyHtml = renderMarkdown(markdownContent);
    const html = buildDirectReportHtml({
      title,
      bodyHtml,
      meta: {
        region: props.region,
        year: props.year
      },
      modelLabel: getModelLabel.value
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    reportHtmlUrl.value = URL.createObjectURL(blob);
  } catch (err) {
    console.error('[Report] 本地排版失败:', err);
    reportError.value = `报告生成失败：${err.message}`;
  } finally {
    reportLoading.value = false;
  }
};

const closeReport = () => {
  reportVisible.value = false;
  setTimeout(() => {
    if (reportHtmlUrl.value) {
      URL.revokeObjectURL(reportHtmlUrl.value);
      reportHtmlUrl.value = '';
    }
  }, 500);
};

const printReport = () => {
  if (!reportHtmlUrl.value) return;
  const win = window.open(reportHtmlUrl.value, '_blank');
  if (!win) {
    // 被浏览器拦截弹窗时降级提示
    alert('请允许弹窗，或使用"新标签"按钮打开后手动打印（Ctrl+P）。');
    return;
  }
  win.addEventListener('load', () => {
    win.print();
    // 打印完成（或用户取消）后自动关闭该窗口
    win.addEventListener('afterprint', () => win.close());
  });
};

const openReportNewTab = () => {
  if (reportHtmlUrl.value) {
    window.open(reportHtmlUrl.value, '_blank');
  }
};

const retryReport = () => {
  if (lastReportMsgSlice.value) {
    generateReport(lastReportMsgSlice.value);
  }
};
</script>

<style scoped>
.ai-modal-overlay {
  position: fixed;
  inset: 0;
  /* 调亮遮罩层背景，去除高强度全局模糊，让底部的地图能够透过毛玻璃显示真实色彩 */
  background: rgba(5, 12, 28, 0.3);
  backdrop-filter: blur(2px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-modal-container {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10000;
  /* 更接近折线图/K线图等全屏分析面板的占屏比例，避免高分辨率下内容被挤压 */
  width: 98vw;
  height: 94vh;
  /* 兼容 2K/4K 屏幕：原 1600px 会导致宽屏下对话内容区域被压缩 */
  max-width: 2400px;
  /* 还原为最干净深邃的毛玻璃（与全屏图表仪表盘统一），因为已经在 HTML 中提取为遮罩平级，Chrome 不再丢失堆叠滤镜上下文 */
  background: rgba(7, 16, 36, 0.6);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 16px;
  display: flex;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.3s ease;
  user-select: text;
  -webkit-user-select: text;
}

.ai-modal-container * {
  user-select: text;
  -webkit-user-select: text;
}

.ai-modal-container.is-sidebar-resizing,
.ai-modal-container.is-sidebar-resizing * {
  user-select: none !important;
  -webkit-user-select: none !important;
}

/* 全屏模式下的响应式调整 */
.ai-modal-container.fullscreen .welcome-container {
  max-width: 900px;
}

.sidebar {
  flex: 0 0 auto;
  box-sizing: border-box;
  min-width: 220px;
  max-width: 520px;
  background: rgba(15, 23, 42, 0.1);
  border-right: 1px solid rgba(255, 255, 255, 0.08); /* 加深分割线 */
  display: flex;
  flex-direction: column;
  padding: 16px;
  transition: background-color 0.3s ease;
  border-top-left-radius: 16px;
  border-bottom-left-radius: 16px;
}

.sidebar-resizer {
  position: relative;
  z-index: 2;
  flex: 0 0 8px;
  width: 8px;
  margin: 0 -3px;
  cursor: col-resize;
  touch-action: none;
  outline: none;
}

.sidebar-resizer span {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 3px;
  width: 1px;
  background: rgba(255, 255, 255, 0.08);
  transition: width 160ms ease, left 160ms ease, background-color 160ms ease;
}

.sidebar-resizer:hover span,
.sidebar-resizer:focus-visible span,
.ai-modal-container.is-sidebar-resizing .sidebar-resizer span {
  left: 2px;
  width: 3px;
  background: rgba(191, 219, 254, 0.72);
}

.sidebar-resizer:focus-visible {
  outline: 1px solid rgba(191, 219, 254, 0.74);
  outline-offset: -1px;
}

.sidebar-header {
  margin-bottom: 20px;
}

.new-chat-btn {
  width: 100%;
  height: 48px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 12px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 12px;
}

.new-chat-btn:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.5);
  transform: translateY(-1px);
}

.plus-circle {
  width: 24px;
  height: 24px;
  background: rgba(59, 130, 246, 0.3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.plus-icon {
  color: #60a5fa;
  font-size: 18px;
  font-weight: 500;
  line-height: 1;
}

.btn-text {
  color: #93c5fd;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  margin-top: 12px;
}

.history-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group-title {
  font-size: 12px;
  color: #64748b;
  padding: 8px 12px;
  font-weight: 500;
}

.history-item {
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.history-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.history-item.active {
  background: rgba(59, 130, 246, 0.15);
}

.item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: 13px;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.delete-session-btn {
  background: transparent;
  border: none;
  color: #64748b;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.history-item:hover .delete-session-btn {
  opacity: 1;
}

.delete-session-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.history-item.active .item-title {
  color: #60a5fa;
  font-weight: 500;
}

.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  background: transparent;
  overflow: hidden;
}

/* ── 自定义滚动条样式 (Premium Scrollbar) ──────────────────────────────────── */

.ai-modal-container ::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.ai-modal-container ::-webkit-scrollbar-track {
  background: transparent;
}

.ai-modal-container ::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.15);
  border-radius: 10px;
  transition: all 0.3s ease;
}

.ai-modal-container ::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.4);
}

/* 针对消息区域的特定优化 */
.messages-container::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.2);
}

/* 针对表格容器（横向滚动条）的特定优化 - 确保在暗色背景下清晰可见 */
.markdown-body :deep(.table-container)::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.3);
}

.markdown-body :deep(.table-container)::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.6);
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
}

.ai-modal-header {
  padding: 12px 20px;
  display: flex;
  justify-content: flex-end;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.close-btn {
  background: rgba(255, 255, 255, 0.05);
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.close-btn:hover {
  background: rgba(245, 108, 108, 0.2);
  color: #fff;
  transform: rotate(90deg) scale(1.1);
}

.close-btn:active {
  transform: rotate(90deg) scale(0.95);
}

.ai-modal-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 14px 18px;
  padding-bottom: 150px;
  display: flex;
  flex-direction: column;
  scroll-behavior: smooth;
}

.ai-modal-body.no-scroll {
  overflow: hidden;
}

.ai-modal-body::-webkit-scrollbar {
  width: 8px;
}

.ai-modal-body::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.3);
  border-radius: 4px;
}

.ai-modal-body::-webkit-scrollbar-thumb {
  background: rgba(71, 85, 105, 0.5);
  border-radius: 4px;
}

.ai-modal-body::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.7);
}

.welcome-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
  padding: 60px 20px 20px 20px;
  animation: fadeIn 0.8s ease-out;
  position: relative;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.welcome-logo {
  width: 160px;
  height: 160px;
  margin-bottom: 20px;
  opacity: 0.95;
  filter: drop-shadow(0 0 30px rgba(255, 255, 255, 0.2));
  transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.welcome-logo:hover {
  transform: scale(1.05);
}

.welcome-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.welcome-title {
  font-size: 26px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 12px 0;
  letter-spacing: 0.4px;
  text-align: center;
  text-wrap: balance;
}

.welcome-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 24px 0;
  text-align: center;
  white-space: nowrap;
}

.centered-input-wrapper {
  width: 100%;
  margin-bottom: 24px;
}

.input-pill {
  max-width: 1000px; /* 增加宽度，对齐消息气泡 */
  margin: 0 auto;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 8px 16px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}

.input-pill:focus-within {
  border-color: rgba(59, 130, 246, 0.6);
  background: rgba(15, 23, 42, 0.85);
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.2), 0 4px 24px rgba(0, 0, 0, 0.5);
}

.input-area textarea {
  width: 100%;
  background: transparent;
  border: none;
  color: #f1f5f9;
  font-size: 15px;
  resize: none;
  outline: none;
  line-height: 1.5;
  height: 22.5px; /* 1.5 * 15px */
  max-height: 200px;
  overflow-y: auto;
}

.input-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 4px;
}

.model-selector-wrapper {
  position: relative;
}

.model-selector-pill {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  white-space: nowrap;
  max-width: 200px;
}

.model-selector-pill:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(59, 130, 246, 0.4);
}

.model-selector-pill.active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
}

.model-dropdown-menu {
  position: absolute;
  bottom: calc(100% + 12px);
  right: 0;
  left: auto;
  min-width: 280px;
  background-color: #0f172a !important; /* 强制纯色深蓝背景，绝不透明 */
  background: #0f172a !important; 
  opacity: 1 !important;
  backdrop-filter: blur(30px) !important; /* 深度模糊 */
  -webkit-backdrop-filter: blur(30px) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important; /* 取消亮边，改为极弱的浅灰色分割线 */
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.9), 
              0 0 30px rgba(59, 130, 246, 0.2);
  overflow: hidden;
  z-index: 1000000 !important; /* 极致层级 */
  pointer-events: all;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.welcome-container .model-dropdown-menu {
  bottom: calc(100% + 12px); /* 统一向上展开 */
  top: auto;
  left: 50%;
  transform: translateX(-50%) !important;
  margin-left: 0;
  background-color: #0f172a !important;
  background: #0f172a !important;
}

.model-dropdown-item {
  padding: 14px 18px;
  background-color: #0f172a !important; /* 强制项背景也为纯色 */
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1); /* 加深分割线 */
}

.model-dropdown-item:hover {
  background: rgba(59, 130, 246, 0.12) !important; /* 对齐滚动词条的悬停感 */
}

.model-dropdown-item:last-child {
  border-bottom: none;
}

.model-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.model-name {
  font-size: 13px;
  color: #e2e8f0;
  font-weight: 600;
  white-space: nowrap;
}

.model-desc {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
}

.model-dropdown-item:hover {
  background: rgba(59, 130, 246, 0.2);
}

.model-dropdown-item.active {
  background: rgba(59, 130, 246, 0.3);
}

.model-dropdown-item.active .model-name {
  color: #60a5fa;
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.2s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.send-btn-pill,
.stop-btn-pill {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.send-btn-pill {
  background: #3b82f6;
  color: white;
}

.stop-btn-pill {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.stop-btn-pill:hover {
  transform: scale(1.1);
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.5);
  background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
}

.stop-btn-pill:active {
  transform: scale(0.92);
}

.questions-scroll-wrapper {
  /* 三行预设问题按复杂度递进，并向两侧对称扩展。 */
  width: calc(100% + 80px);
  margin-left: -70px;
  margin-right: -70px;
  overflow: hidden;
  position: relative;
  padding: 8px 0;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  /* 左右渐变遮罩，让词条渐隐消失 */
  -webkit-mask-image: linear-gradient(to right,
      transparent 0%,
      black 8%,
      black 92%,
      transparent 100%);
  mask-image: linear-gradient(to right,
      transparent 0%,
      black 8%,
      black 92%,
      transparent 100%);
}

.questions-scroll-track {
  display: flex;
  gap: 12px;
  width: max-content;
}

.questions-scroll-track.scroll-left {
  animation: scroll-left 25s linear infinite;
}

.questions-scroll-track.scroll-right {
  animation: scroll-right 30s linear infinite;
}

.questions-scroll-track.difficulty-1 {
  animation-duration: 34s;
}

.questions-scroll-track.difficulty-2 {
  animation-duration: 42s;
}

.questions-scroll-track.difficulty-3 {
  animation-duration: 50s;
}

.questions-scroll-track:hover {
  animation-play-state: paused;
}

@keyframes scroll-left {
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(-50%);
  }
}

@keyframes scroll-right {
  0% {
    transform: translateX(-50%);
  }

  100% {
    transform: translateX(0);
  }
}

.quick-btn {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 10px 18px;
  color: #94a3b8;
  font-size: 13px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.quick-btn:hover {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.4);
  color: #f1f5f9;
  transform: scale(1.02);
}

.message {
  display: flex;
  flex-direction: column;
  width: 100%;
  /* 弹窗已放大，正文容器也需要同步放宽，否则会显得“窗口大但内容挤” */
  max-width: 1600px;
  margin: 0 auto;
}

.message.user {
  align-items: flex-end;
  /* 用户消息右对齐 */
  margin-bottom: 18px;
}

.bubble-wrapper {
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
}

.message.user .bubble-wrapper {
  width: 100%;
  max-width: 1600px;
  display: flex;
  justify-content: flex-end;
}

.bubble {
  padding: 0;
  background: transparent;
  border: none;
  font-size: 14px;
  line-height: 1.62;
  color: #e2e8f0;
  text-align: left;
  word-break: normal;
  overflow-wrap: anywhere;
}

.user .bubble {
  width: fit-content;
  max-width: min(72ch, 76%);
  margin-left: auto;
  color: #ffffff;
  background: rgba(27, 53, 95, 0.96);
  padding: 14px 20px;
  border-radius: 20px 20px 6px 20px;
  font-weight: 400;
  font-size: 16px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  box-shadow: 0 1px 2px rgba(2, 6, 23, 0.18);
  text-align: left;
}

.assistant .bubble {
  color: #e2e8f0;
}

.thinking-process {
  background: transparent;
  border-radius: 0;
  margin-bottom: 6px;
  border: none;
}

.thinking-header {
  padding: 2px 0;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  cursor: pointer;
  font-size: 13px;
  color: #94a3b8;
  user-select: text;
  -webkit-user-select: text;
  background: transparent;
  border-radius: 0;
  margin-bottom: 4px;
  transition: color 0.2s ease;
  border: none;
}

.thinking-header:hover {
  color: #e2e8f0;
}

.thinking-header:active {
  transform: scale(0.98);
}

.thinking-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.optimized-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  border: 1px solid rgba(16, 185, 129, 0.2);
  margin-left: 8px;
  animation: fadeIn 0.3s ease;
}

.optimized-tag svg {
  opacity: 0.8;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateX(-5px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.thinking-icon-svg,
.arrow-icon-svg {
  color: #94a3b8;
  transition: all 0.3s ease;
}

@media (max-width: 768px) {
  .ai-modal-container {
    width: 100vw;
    height: 100vh;
    max-width: none;
    border-radius: 0;
  }

  .user .bubble {
    max-width: 92%;
    padding: 12px 16px;
    font-size: 16px;
  }
}

.thinking-icon-svg.is-thinking {
  color: #fbbf24;
  filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.4));
  animation: pulse 2s infinite;
}

.arrow-icon-svg {
  margin-left: auto;
  opacity: 0.85;
  transform-origin: center;
}

.arrow-icon-svg.open {
  transform: rotate(180deg);
}

@keyframes pulse {
  0% {
    opacity: 0.7;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.05);
  }

  100% {
    opacity: 0.7;
    transform: scale(1);
  }
}

.message-actions {
  margin-top: 4px;
  display: flex;
  justify-content: flex-start;
  opacity: 1;
  transition: opacity 0.2s;
}

.action-btn {
  background: transparent;
  border: none;
  color: #64748b;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #94a3b8;
}

.copy-icon-svg {
  stroke-width: 2px;
}

.thinking-content {
  padding: 2px 0 8px 20px;
  font-size: 13px;
  color: #94a3b8;
  white-space: pre-wrap;
  line-height: 1.5;
}

.thinking-expand-mask:hover {
  height: 80px;
  background: linear-gradient(to bottom, transparent, rgba(30, 41, 59, 0.98));
}

.expand-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #60a5fa;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 12px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 20px;
  border: 1px solid rgba(59, 130, 246, 0.2);
  transition: all 0.2s ease;
}

.thinking-expand-mask:hover .expand-hint {
  transform: translateY(-2px);
  background: rgba(59, 130, 246, 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.ai-modal-footer {
  position: absolute;
  bottom: -1px; /* 稍微下移防止亚像素间隙 */
  left: 0;
  right: 0;
  padding: 14px 18px;
  padding-top: 28px;
  border-top: none;
  /* 弱化底部实色渐变，让毛玻璃更纯粹，仅保留微弱阴影托底 */
  background: linear-gradient(to top, rgba(7, 16, 36, 0.85) 0%, rgba(7, 16, 36, 0) 100%);
  z-index: 10;
  overflow: visible !important;
}

.footer-hint {
  margin-top: 8px;
  text-align: center;
  font-size: 11px;
  color: #64748b;
}

/* AI 正文使用稳定的双栏阅读结构；Agent 执行树仍保持全宽。 */
.assistant .bubble,
.assistant .message-actions {
  width: min(100%, 1320px);
  margin-right: auto;
  margin-left: auto;
}

.assistant .message-actions {
  margin-top: 6px;
}

.markdown-body {
  color: #d9e1ea;
  font-family: "Times New Roman", SimSun, "Songti SC", serif;
  font-size: 15.5px;
  line-height: 1.76;
  letter-spacing: 0;
  text-align: left;
  overflow-wrap: anywhere;
}

/* 仅在回答完成后分栏，避免流式内容随新增文本反复重排。 */
.assistant .markdown-body:not(.is-streaming) {
  column-count: 2;
  column-gap: 38px;
  column-rule: 1px solid rgba(148, 163, 184, 0.2);
  column-fill: balance;
}

.assistant .markdown-body:not(.is-streaming) :deep(h1) {
  column-span: all;
}

.assistant .markdown-body:not(.is-streaming) :deep(h2),
.assistant .markdown-body:not(.is-streaming) :deep(h3),
.assistant .markdown-body:not(.is-streaming) :deep(h4),
.assistant .markdown-body:not(.is-streaming) :deep(h5),
.assistant .markdown-body:not(.is-streaming) :deep(h6),
.assistant .markdown-body:not(.is-streaming) :deep(.table-container),
.assistant .markdown-body:not(.is-streaming) :deep(pre),
.assistant .markdown-body:not(.is-streaming) :deep(.katex-display),
.assistant .markdown-body:not(.is-streaming) :deep(.mermaid) {
  break-inside: avoid-column;
}

.assistant .markdown-body:not(.is-streaming) :deep(h2),
.assistant .markdown-body:not(.is-streaming) :deep(h3),
.assistant .markdown-body:not(.is-streaming) :deep(h4),
.assistant .markdown-body:not(.is-streaming) :deep(h5),
.assistant .markdown-body:not(.is-streaming) :deep(h6) {
  break-after: avoid-column;
}

.markdown-body > :deep(:first-child) {
  margin-top: 0;
}

.markdown-body :deep(p) {
  margin: 0 0 0.9em;
  color: #d4dde7;
  line-height: 1.76;
  text-align: justify;
  text-indent: 2em;
}

.markdown-body :deep(li > p),
.markdown-body :deep(blockquote p),
.markdown-body :deep(td p),
.markdown-body :deep(th p) {
  text-indent: 0;
}

.markdown-body :deep(li > p),
.markdown-body :deep(blockquote p),
.markdown-body :deep(td p),
.markdown-body :deep(th p) {
  margin: 0;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin: 1.7em 0 0.65em;
  color: #f1f5f9;
  font-family: "Times New Roman", SimHei, "Heiti SC", sans-serif;
  font-weight: 650;
  line-height: 1.45;
  letter-spacing: 0;
  text-align: left;
}

.markdown-body :deep(h1) {
  padding-bottom: 0.45em;
  border-bottom: 2px solid rgba(126, 160, 202, 0.7);
  font-size: 22px;
}

.markdown-body :deep(h2) {
  padding-bottom: 0.38em;
  border-bottom: 1px solid rgba(148, 163, 184, 0.24);
  font-size: 19px;
}

.markdown-body :deep(h3) {
  font-size: 17px;
}

.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  font-size: 15.5px;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0.45em 0 1em;
  padding-left: 1.75em;
  text-indent: 0;
}

.markdown-body :deep(li) {
  margin: 0 0 0.42em;
  color: #d4dde7;
  line-height: 1.7;
}

.markdown-body :deep(li::marker) {
  color: #9aacc0;
  font-weight: 600;
}

.markdown-body :deep(strong) {
  color: #60a5fa;
  font-weight: 700;
}

.markdown-body :deep(em) {
  color: #c4cfdb;
}

.markdown-body :deep(a) {
  color: #8fb9e8;
  text-decoration: none;
  text-underline-offset: 3px;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(blockquote) {
  margin: 1.15em 0;
  padding: 10px 16px;
  border: 0;
  border-left: 3px solid rgba(126, 160, 202, 0.72);
  border-radius: 0;
  background: rgba(126, 160, 202, 0.08);
  color: #cbd5e1;
  text-indent: 0;
}

.markdown-body :deep(.table-container) {
  width: 100%;
  margin: 1.35em 0;
  overflow-x: auto;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 5px;
  background: rgba(8, 18, 33, 0.38);
  text-align: left;
  text-indent: 0;
}

.markdown-body :deep(table) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  margin: 0;
  border-spacing: 0;
  border-collapse: collapse;
  table-layout: auto;
  font-family: "Times New Roman", SimSun, "Songti SC", serif;
  font-size: 13.5px;
}

.markdown-body :deep(th) {
  padding: 10px 13px;
  border-right: 1px solid rgba(255, 255, 255, 0.07);
  border-bottom: 1px solid rgba(255, 255, 255, 0.13);
  background: #172b46;
  color: #edf3f9;
  font-weight: 650;
  line-height: 1.55;
  text-align: center;
  vertical-align: middle;
  white-space: nowrap;
}

.markdown-body :deep(td) {
  min-width: 72px;
  padding: 9px 13px;
  border-right: 1px solid rgba(148, 163, 184, 0.1);
  border-bottom: 1px solid rgba(148, 163, 184, 0.13);
  color: #cfdae5;
  line-height: 1.55;
  text-align: center;
  vertical-align: middle;
  white-space: normal;
  word-break: normal;
  overflow-wrap: anywhere;
}

.markdown-body :deep(th p),
.markdown-body :deep(td p) {
  text-align: inherit;
}

.markdown-body :deep(tbody tr:nth-child(even)) {
  background: rgba(148, 163, 184, 0.045);
}

.markdown-body :deep(th:last-child),
.markdown-body :deep(td:last-child) {
  border-right: 0;
}

.markdown-body :deep(tr:last-child td) {
  border-bottom: 0;
}

.markdown-body :deep(tbody tr:hover) {
  background: rgba(148, 163, 184, 0.075);
}

.markdown-body :deep(code) {
  padding: 0.12em 0.38em;
  border-radius: 3px;
  background: rgba(148, 163, 184, 0.13);
  color: #dce7f3;
  font-family: "Cascadia Code", Consolas, "Courier New", monospace;
  font-size: 0.88em;
}

.markdown-body :deep(pre) {
  margin: 1.2em 0;
  padding: 15px 17px;
  overflow-x: auto;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 5px;
  background: rgba(5, 13, 25, 0.76);
  color: #d7e0e9;
  font-size: 13px;
  line-height: 1.65;
  text-indent: 0;
}

.markdown-body :deep(pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
  font-size: inherit;
}

.markdown-body :deep(hr) {
  margin: 1.8em 0;
  border: 0;
  border-top: 1px solid rgba(148, 163, 184, 0.22);
}

.markdown-body :deep(.katex-display) {
  margin: 1.2em 0;
  padding: 4px 0;
  overflow-x: auto;
  overflow-y: hidden;
  text-align: center;
}

.markdown-body :deep(.mermaid) {
  width: 100%;
  margin: 1.3em 0;
  padding: 14px 0;
  overflow-x: auto;
  border-top: 1px solid rgba(148, 163, 184, 0.16);
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  background: transparent;
  text-align: center;
}

.markdown-body :deep(.mermaid svg) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
}

.markdown-body :deep(.md-stream-tail) {
  display: block;
}

.markdown-body :deep(.md-stream-tail > :last-child) {
  margin-bottom: 0;
}

@media (max-width: 1180px) {
  .assistant .markdown-body:not(.is-streaming) {
    column-count: 1;
    column-gap: 0;
    column-rule: 0;
  }
}

@media (max-width: 760px) {
  .assistant .bubble,
  .assistant .message-actions {
    width: 100%;
  }

  .markdown-body {
    font-size: 15px;
    line-height: 1.72;
  }

  .markdown-body :deep(p) {
    line-height: 1.72;
  }

  .markdown-body :deep(h1) {
    font-size: 20px;
  }

  .markdown-body :deep(h2) {
    font-size: 18px;
  }

}

/* ── AI 步进器 (Industrial Progress Stepper) ────────────────────────────────── */
.industrial-stepper {
  margin: 6px 0 14px 0;
  padding: 10px 12px 8px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: relative;
  opacity: 0.96;
}

.workflow-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 9px 0;
  flex-wrap: wrap;
  cursor: pointer;
  user-select: text;
  -webkit-user-select: text;
}

.workflow-title {
  font-size: 12.5px;
  font-weight: 700;
  color: #e2e8f0;
  letter-spacing: 0.2px;
}

.workflow-subtitle {
  font-size: 11px;
  color: #7890a5;
}

.workflow-legend {
  display: inline-flex;
  gap: 6px;
  margin-left: auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
}

.workflow-arrow {
  margin-left: 6px;
  color: rgba(148, 163, 184, 0.9);
  transition: transform 0.18s ease;
}

.workflow-arrow.open {
  transform: rotate(180deg);
}

.workflow-collapsed {
  margin: 6px 0 2px 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.28);
  border: 1px dashed rgba(148, 163, 184, 0.22);
  color: rgba(148, 163, 184, 0.92);
  font-size: 11px;
}

.legend-dot {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.35);
  border: 1px solid rgba(148, 163, 184, 0.18);
  user-select: text;
  -webkit-user-select: text;
  white-space: nowrap;
}

.legend-dot::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.6);
  box-shadow: 0 0 0 2px rgba(148, 163, 184, 0.12);
}

/* 仅三类需要“明显区别于绿色”的高亮：tool/skill/knowledge-graph */
.legend-dot.lane-tool::before { background: rgba(245, 158, 11, 0.95); box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.16); }
.legend-dot.lane-skill::before { background: rgba(56, 189, 248, 0.95); box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.16); }
.legend-dot.lane-knowledge-graph::before { background: rgba(167, 139, 250, 0.95); box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.16); }
.legend-dot.lane-policy::before { background: rgba(20, 184, 166, 0.95); box-shadow: 0 0 0 2px rgba(20, 184, 166, 0.16); }

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  position: relative;
  padding: 0 0 11px 0;
  opacity: 0;
  transform: translateX(-6px);
  animation: stepAppear 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes stepAppear {
  to { opacity: 1; transform: translateX(0); }
}

.step-item:last-child {
  padding-bottom: 0;
}

.step-item::before {
  content: "";
  position: absolute;
  left: -10px;
  top: 2px;
  bottom: 10px;
  width: 3px;
  border-radius: 3px;
  background: rgba(52, 211, 153, 0.22);
}

.step-item.lane-tool::before {
  background: rgba(245, 158, 11, 0.62);
}

.step-item.lane-skill::before {
  background: rgba(56, 189, 248, 0.62);
}

.step-item.lane-knowledge-graph::before {
  background: rgba(167, 139, 250, 0.62);
}

.step-item.lane-policy::before {
  background: rgba(20, 184, 166, 0.62);
}



/* lane label 颜色变量：同步改变“绿色文本”本体颜色，而不是只做标签/色条 */
.step-item.lane-tool { --lane-label-color: #fbbf24; --lane-label-glow: rgba(245, 158, 11, 0.22); }
.step-item.lane-skill { --lane-label-color: #7dd3fc; --lane-label-glow: rgba(56, 189, 248, 0.20); }
.step-item.lane-knowledge-graph { --lane-label-color: #c4b5fd; --lane-label-glow: rgba(167, 139, 250, 0.20); }
.step-item.lane-policy { --lane-label-color: #5eead4; --lane-label-glow: rgba(20, 184, 166, 0.20); }

.step-item.lane-tool .step-icon, .step-item.lane-tool.done .step-icon, .step-item.lane-tool.active .step-icon {
  background: rgba(180, 83, 9, 0.12);
  border-color: rgba(245, 158, 11, 0.62);
  color: #fbbf24;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.08);
}

.step-item.lane-skill .step-icon, .step-item.lane-skill.done .step-icon, .step-item.lane-skill.active .step-icon {
  background: rgba(3, 105, 161, 0.12);
  border-color: rgba(56, 189, 248, 0.62);
  color: #7dd3fc;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.08);
}

.step-item.lane-knowledge-graph .step-icon, .step-item.lane-knowledge-graph.done .step-icon, .step-item.lane-knowledge-graph.active .step-icon {
  background: rgba(109, 40, 217, 0.10);
  border-color: rgba(167, 139, 250, 0.62);
  color: #c4b5fd;
  box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.08);
}

.step-item.lane-policy .step-icon, .step-item.lane-policy.done .step-icon, .step-item.lane-policy.active .step-icon {
  background: rgba(15, 118, 110, 0.10);
  border-color: rgba(20, 184, 166, 0.62);
  color: #5eead4;
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.08);
}



/* lane 文本颜色走变量统一控制（避免重复覆盖） */



.step-line {
  position: absolute;
  left: 8.5px;
  top: 19px;
  bottom: -4px;
  width: 1px;
  background: linear-gradient(to bottom, rgba(52, 211, 153, 0.42), rgba(52, 211, 153, 0.08));
  z-index: 1;
}

/* lane 连接线：仅三类突出，其余保持默认绿色 */
.step-item.lane-tool .step-line {
  background: linear-gradient(to bottom, rgba(245, 158, 11, 0.52), rgba(245, 158, 11, 0.10));
}
.step-item.lane-skill .step-line {
  background: linear-gradient(to bottom, rgba(56, 189, 248, 0.52), rgba(56, 189, 248, 0.10));
}
.step-item.lane-knowledge-graph .step-line {
  background: linear-gradient(to bottom, rgba(167, 139, 250, 0.52), rgba(167, 139, 250, 0.10));
}
.step-item.lane-policy .step-line {
  background: linear-gradient(to bottom, rgba(20, 184, 166, 0.52), rgba(20, 184, 166, 0.10));
}

.step-indicator {
  position: relative;
  width: 18px;
  height: 18px;
  margin-top: 1px;
  flex-shrink: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-icon {
  width: 100%;
  height: 100%;
  background: rgba(6, 78, 59, 0.22);
  border: 1px solid rgba(52, 211, 153, 0.42);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #34d399;
  transition: all 0.3s ease;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.05);
}

.step-item.done .step-icon {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(52, 211, 153, 0.46);
  color: #34d399;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.05);
}

.step-item.active .step-icon {
  background: rgba(16, 185, 129, 0.16);
  border-color: rgba(110, 231, 183, 0.72);
  color: #6ee7b7;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.08), 0 0 18px rgba(16, 185, 129, 0.16);
}

.step-pulse {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1px solid rgba(52, 211, 153, 0.28);
  animation: stepPulse 2s infinite;
}

@keyframes stepPulse {
  0% { transform: scale(0.8); opacity: 0; }
  50% { opacity: 0.5; }
  100% { transform: scale(1.5); opacity: 0; }
}

.step-content {
  padding-top: 0;
  min-width: 0;
  max-width: calc(100% - 28px);
}

.step-label {
  display: inline;
  font-size: 13px;
  font-weight: 700;
  /* 默认颜色：由 lane 变量覆盖（避免所有步骤都“绿油油”） */
  color: var(--lane-label-color, #34d399);
  margin-bottom: 0;
  line-height: 1.46;
  letter-spacing: 0.1px;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  text-shadow: 0 0 12px var(--lane-label-glow, rgba(16, 185, 129, 0.18));
  overflow-wrap: anywhere;
}

.step-item.done .step-label {
  /* done/active 不再强行覆盖颜色，改为轻微降低亮度以保留 lane 色彩 */
  filter: brightness(0.98);
  opacity: 0.92;
}

.step-item.active .step-label {
  filter: brightness(1.06);
  opacity: 1;
}

.step-detail {
  display: none;
}

.modal-fade-enter-active {
  transition: opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-fade-leave-active {
  transition: opacity 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.ai-modal-container {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 当父级处于 transition 状态时，对容器应用缩放 */
.modal-fade-enter-from .ai-modal-container,
.modal-fade-leave-to .ai-modal-container {
  transform: scale(0.8);
  opacity: 0;
}
/* ── 生成报告按钮 ─────────────────────────────────────────────────────────── */

.report-btn {
  color: #60a5fa;
}

.report-btn:hover:not(:disabled) {
  color: #93c5fd;
  background: rgba(96, 165, 250, 0.1);
}

.report-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.spin { animation: spin 1s linear infinite; }

/* ── 报告弹窗 ─────────────────────────────────────────────────────────────── */

.report-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.report-modal {
  width: min(900px, 96vw);
  height: min(88vh, 900px);
  background: #1a2035;
  border-radius: 14px;
  border: 1px solid rgba(96, 165, 250, 0.25);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.report-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(15, 23, 42, 0.7);
  flex-shrink: 0;
}

.report-modal-title {
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
  display: flex;
  align-items: center;
}

.report-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.report-action-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.report-action-btn:hover {
  background: rgba(96, 165, 250, 0.15);
  color: #93c5fd;
  border-color: rgba(96, 165, 250, 0.3);
}

.report-close-btn {
  background: rgba(255, 255, 255, 0.05);
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 22px;
  line-height: 1;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.report-close-btn:hover {
  background: rgba(245, 108, 108, 0.2);
  color: #fff;
  transform: rotate(90deg) scale(1.1);
}

.report-close-btn:active {
  transform: rotate(90deg) scale(0.95);
}

.report-modal-body {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.report-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #ffffff;
}

.report-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 20px;
  color: #94a3b8;
  font-size: 14px;
  text-align: center;
  line-height: 1.8;
}

.report-loading small { color: #60a5fa; font-size: 12px; }

.report-loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(96, 165, 250, 0.2);
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.report-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 14px;
  color: #94a3b8;
  font-size: 14px;
}

.report-retry-btn {
  background: rgba(96, 165, 250, 0.15);
  border: 1px solid rgba(96, 165, 250, 0.3);
  color: #60a5fa;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.report-retry-btn:hover {
  background: rgba(96, 165, 250, 0.25);
}

/* 弹窗入场动画 */
.report-fade-enter-active,
.report-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.report-fade-enter-from,
.report-fade-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

/* GeoAI Agent trace: three-level execution tree */
.agent-process-panel {
  --trace-text-strong: #e7edf4;
  --trace-text: #c5d0dc;
  --trace-text-muted: #96a5b5;
  --trace-line: rgba(255, 255, 255, 0.2);
  --trace-line-soft: rgba(255, 255, 255, 0.1);
  --trace-link-hover: #93c5fd;
  margin: 18px 0 24px;
  overflow: visible;
  border: 0;
  border-top: 0;
  border-bottom: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: var(--trace-text);
  font-family: "Times New Roman", SimSun, "Songti SC", serif;
  letter-spacing: 0;
}

.agent-process-header {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  min-height: 62px;
  margin: 0;
  padding: 12px 2px;
  border: 0;
  border-bottom: 0;
  border-radius: 0;
  outline: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  user-select: text;
  -webkit-user-select: text;
}

.agent-process-header:hover {
  background: transparent;
}

.agent-process-header:focus-visible,
.agent-trace-stage-header.is-expandable:focus-visible,
.trace-detail-toggle:focus-visible {
  outline: none;
}

.agent-process-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.agent-process-mark img,
.agent-trace-dot img,
.trace-model-monologue-icon img,
.trace-detail-icon img {
  display: block;
  width: 23px;
  height: 23px;
  object-fit: contain;
  transform: scale(var(--trace-icon-optical-scale, 1));
  transform-origin: center;
  filter: brightness(0) invert(1);
  opacity: 0.9;
}

.agent-process-mark img {
  width: 27px;
  height: 27px;
}

.trace-icon-deepseek {
  --trace-icon-optical-scale: 1.12;
}

.trace-icon-data {
  --trace-icon-optical-scale: 1.08;
}

.trace-icon-reasoning,
.trace-icon-context,
.trace-icon-policy,
.trace-icon-nlp {
  --trace-icon-optical-scale: 1.05;
}

.trace-icon-js,
.trace-icon-tool {
  --trace-icon-optical-scale: 1.03;
}

.agent-process-mark.running {
  border: 0;
  background: transparent;
  animation: agentMarkPulse 1.8s ease-in-out infinite;
}

.agent-process-current-action {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  flex: 0 1 auto;
  overflow: hidden;
  animation: agentProcessActionIn 220ms ease-out both;
}

.agent-process-title {
  min-width: 0;
  flex: 0 1 auto;
  margin: 0;
  color: #edf2f7;
  font-size: 18px;
  font-weight: 650;
  line-height: 1.45;
  letter-spacing: 0;
  text-align: left;
  text-wrap: balance;
  font-family: "Times New Roman", SimHei, "Heiti SC", sans-serif;
  transition: color 150ms ease, text-decoration-color 150ms ease;
}

.agent-process-title:hover,
.agent-process-header:focus-visible .agent-process-title {
  color: var(--trace-link-hover);
  text-decoration: underline;
  text-decoration-color: rgba(147, 197, 253, 0.52);
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}

.agent-process-title.is-running {
  color: transparent;
  background: linear-gradient(
    100deg,
    #aebbc9 0%,
    #aebbc9 39%,
    #f8fafc 49%,
    #dbeafe 53%,
    #aebbc9 63%,
    #aebbc9 100%
  );
  background-size: 240% 100%;
  background-position: 100% 50%;
  -webkit-background-clip: text;
  background-clip: text;
  animation: agentProcessTextWave 2.35s ease-in-out infinite;
}

.agent-process-state {
  flex: 0 0 auto;
  color: #aab7c5;
  font-size: 13px;
  line-height: 1.5;
}

.agent-process-state.running {
  color: #bfdbfe;
}

.agent-process-chevron,
.agent-trace-chevron,
.trace-detail-chevron {
  flex: 0 0 auto;
  color: #8797a8;
  opacity: 0.62;
  transform: rotate(0);
  transition: transform 160ms ease, color 160ms ease;
}

.agent-process-chevron.open,
.agent-trace-chevron.open,
.trace-detail-chevron.open {
  transform: rotate(90deg);
}

.agent-process-title:hover ~ .agent-process-chevron,
.agent-process-header:focus-visible .agent-process-chevron,
.agent-trace-stage-header.is-expandable .agent-trace-title:hover ~ .agent-trace-chevron,
.agent-trace-stage-header.is-expandable:focus-visible .agent-trace-chevron,
.trace-detail-label:hover ~ .trace-detail-chevron,
.trace-detail-toggle:focus-visible .trace-detail-chevron {
  color: var(--trace-link-hover);
  opacity: 1;
}

.agent-trace-list {
  display: block;
  padding: 15px 0 11px;
  background: transparent;
}

.agent-trace-event {
  position: relative;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 12px;
  min-width: 0;
  margin: 0;
  padding: 0 0 7px;
}

.agent-trace-rail {
  position: relative;
  display: flex;
  justify-content: center;
}

.agent-trace-dot {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #ffffff;
}

.agent-trace-dot img {
  width: 24px;
  height: 24px;
  opacity: 0.96;
}

.agent-trace-line {
  position: absolute;
  top: 34px;
  bottom: -7px;
  width: 1px;
  background: var(--trace-line);
}

.agent-trace-stage {
  min-width: 0;
  margin: 0;
  padding: 0 0 12px;
  border: 0;
  border-bottom: 0;
  background: transparent;
}

.agent-trace-event:last-child .agent-trace-stage {
  border-bottom: 0;
}

.agent-trace-stage-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  min-width: 0;
  min-height: 44px;
  margin: -2px 0 0;
  padding: 3px 4px 9px 0;
  border: 0;
  border-radius: 0;
  outline: none;
  background: transparent;
  color: inherit;
  text-align: left;
}

.agent-trace-stage-header.is-expandable {
  cursor: pointer;
}

.agent-trace-stage-header.is-expandable:hover {
  background: transparent;
}

.agent-trace-stage-heading {
  min-width: 0;
  flex: 1;
}

.agent-trace-title-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  width: fit-content;
  max-width: 100%;
  min-width: 0;
}

.agent-trace-title {
  min-width: 0;
  margin: 0;
  color: var(--trace-text-strong);
  font-size: 16px;
  font-weight: 650;
  line-height: 1.55;
  letter-spacing: 0;
  white-space: normal;
  font-family: "Times New Roman", SimHei, "Heiti SC", sans-serif;
  transition: color 150ms ease, text-decoration-color 150ms ease;
}

.agent-trace-stage-header.is-expandable .agent-trace-title:hover,
.agent-trace-stage-header.is-expandable:focus-visible .agent-trace-title {
  color: var(--trace-link-hover);
  text-decoration: underline;
  text-decoration-color: rgba(147, 197, 253, 0.5);
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}

.agent-trace-status {
  flex: 0 0 auto;
  margin: 0;
  color: #8999aa;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.5;
}

.agent-trace-status.status-running {
  color: #bfdbfe;
}

.agent-trace-status.status-error {
  color: #d99a9a;
}

.agent-trace-summary-text {
  margin: 3px 0 0;
  color: #aab6c5;
  font-size: 14px;
  line-height: 1.68;
  white-space: normal;
  overflow-wrap: anywhere;
}

.agent-trace-chevron {
  margin-top: 1px;
}

.agent-trace-branch {
  position: relative;
  margin: -1px 0 8px 13px;
  padding: 4px 0 3px 20px;
  border-left: 1px solid var(--trace-line);
}

.trace-model-monologue {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
  min-width: 0;
  margin: 1px 0 10px;
  padding: 5px 4px 8px 0;
}

.trace-model-monologue-icon {
  display: inline-flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 3px;
}

.trace-model-monologue-icon img {
  width: 23px;
  height: 23px;
  opacity: 0.92;
}

.trace-model-monologue-copy {
  min-width: 0;
}

.trace-model-monologue-label {
  display: block;
  margin: 0 0 3px;
  color: #9eadbd;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  font-family: "Times New Roman", SimHei, "Heiti SC", sans-serif;
}

.trace-model-monologue-copy p {
  max-height: none;
  margin: 0;
  padding-right: 8px;
  overflow: visible;
  color: #c3ceda;
  font-size: 14.5px;
  line-height: 1.75;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.trace-detail-tree {
  position: relative;
  min-width: 0;
  margin: 1px 0 0 11px;
  padding: 0 0 0 18px;
  border-left: 1px solid rgba(143, 158, 177, 0.2);
}

.trace-detail-item {
  position: relative;
  min-width: 0;
  margin: 0;
}

.trace-detail-item::before {
  content: "";
  position: absolute;
  top: 21px;
  left: -18px;
  width: 13px;
  border-top: 1px solid rgba(143, 158, 177, 0.2);
}

.trace-detail-toggle {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 43px;
  margin: 0;
  padding: 6px 4px 6px 0;
  border: 0;
  border-radius: 0;
  outline: none;
  background: transparent;
  color: var(--trace-text);
  text-align: left;
  cursor: pointer;
}

.trace-detail-toggle:hover {
  background: transparent;
}

.trace-detail-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
}

.trace-detail-icon img {
  width: 22px;
  height: 22px;
  opacity: 0.92;
}

.trace-detail-label {
  min-width: 0;
  flex: 0 1 auto;
  color: #d2dbe5;
  font-size: 14.5px;
  font-weight: 560;
  line-height: 1.55;
  font-family: "Times New Roman", SimHei, "Heiti SC", sans-serif;
  transition: color 150ms ease, text-decoration-color 150ms ease;
}

.trace-detail-label:hover,
.trace-detail-toggle:focus-visible .trace-detail-label {
  color: var(--trace-link-hover);
  text-decoration: underline;
  text-decoration-color: rgba(147, 197, 253, 0.48);
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}

.agent-process-title,
.agent-trace-stage-header.is-expandable .agent-trace-title,
.trace-detail-label {
  cursor: pointer;
}

.trace-detail-meta {
  flex: 0 1 auto;
  overflow: hidden;
  color: #8797a8;
  font-size: 12.5px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-detail-chevron {
  margin: 0 2px 0 -3px;
}

.trace-detail-content {
  min-width: 0;
  margin: 0 0 4px 31px;
  padding: 3px 6px 14px 0;
  color: var(--trace-text);
}

.trace-section-text {
  margin: 0;
  color: #bdc9d6;
  font-size: 14px;
  line-height: 1.75;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.trace-tool-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
  padding: 2px 0;
}

.trace-tool-copy {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 5px 11px;
  min-width: 0;
  flex: 1;
}

.trace-tool-copy strong {
  color: #d8e1eb;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.55;
}

.trace-tool-copy code {
  color: #9eafc0;
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.trace-tool-action {
  color: #c4ced9;
  font-size: 14px;
  line-height: 1.55;
}

.trace-tool-source {
  flex: 0 0 auto;
  color: #9eacbb;
  font-size: 12.5px;
  line-height: 1.5;
}

.trace-kv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 0 22px;
  margin: 0;
  padding: 0;
}

.trace-kv-item {
  display: grid;
  grid-template-columns: minmax(76px, max-content) minmax(0, 1fr);
  gap: 11px;
  min-width: 0;
  margin: 0;
  padding: 7px 0;
  border-bottom: 1px solid rgba(143, 158, 177, 0.1);
  font-size: 14px;
  line-height: 1.62;
}

.trace-kv-key,
.trace-kv-value {
  margin: 0;
}

.trace-kv-key {
  color: #8fa0b1;
  white-space: nowrap;
}

.trace-kv-value {
  min-width: 0;
  color: #c6d0dc;
  white-space: normal;
  overflow-wrap: anywhere;
}

.trace-code-block {
  box-sizing: border-box;
  width: 100%;
  max-height: 360px;
  margin: 10px 0 0;
  padding: 12px 14px;
  overflow: auto;
  border: 1px solid rgba(143, 158, 177, 0.16);
  border-radius: 5px;
  background: rgba(7, 15, 26, 0.54);
  color: #b9c6d4;
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 13px;
  line-height: 1.65;
  letter-spacing: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.trace-observation-summary {
  margin: 0;
}

.trace-result-block {
  max-height: 420px;
}

.trace-error-text {
  margin: 0;
  padding: 8px 11px;
  border-left: 2px solid rgba(217, 119, 119, 0.68);
  background: rgba(127, 29, 29, 0.08);
  color: #e0a7a7;
  font-size: 14px;
  line-height: 1.65;
  white-space: pre-wrap;
}

.agent-trace-event.is-compact {
  padding-bottom: 2px;
}

.agent-trace-event.is-compact .agent-trace-stage {
  padding-bottom: 9px;
}

.agent-trace-event.is-compact .agent-trace-stage-header {
  min-height: 38px;
  padding-bottom: 5px;
}

.agent-trace-event.phase-tool_call .agent-trace-dot {
  border: 0;
}

.agent-trace-event.phase-observation .agent-trace-dot {
  border: 0;
}

.agent-trace-event.phase-synthesis .agent-trace-dot {
  border: 0;
}

.agent-trace-event.status-error .agent-trace-dot {
  border: 0;
  background: transparent;
  color: #ffffff;
}

.agent-trace-spinner {
  width: 11px;
  height: 11px;
  border: 1.5px solid #ffffff;
  border-right-color: transparent;
  border-radius: 50%;
  animation: traceSpin 0.8s linear infinite;
}

.agent-trace-error-mark {
  font-size: 14px;
  font-weight: 700;
}

.agent-process-panel ::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.agent-process-panel ::-webkit-scrollbar-thumb {
  border-radius: 6px;
  background: rgba(126, 145, 166, 0.34);
}

.agent-process-panel ::-webkit-scrollbar-track {
  background: transparent;
}

@keyframes agentMarkPulse {
  0%, 100% { opacity: 0.62; }
  50% { opacity: 1; }
}

@keyframes agentProcessActionIn {
  from {
    opacity: 0;
    transform: translateX(-9px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes agentProcessTextWave {
  0% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes traceSpin {
  to { transform: rotate(360deg); }
}

@media (max-width: 760px) {
  .agent-process-panel {
    margin: 14px 0 20px;
  }

  .agent-process-header {
    align-items: flex-start;
    min-height: 58px;
    padding: 12px 0;
  }

  .agent-process-title {
    font-size: 16px;
    line-height: 1.5;
  }

  .agent-process-state {
    padding-top: 2px;
  }

  .agent-process-chevron {
    margin-top: 4px;
  }

  .agent-trace-list {
    padding-top: 12px;
  }

  .agent-trace-event {
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 9px;
  }

  .agent-trace-dot {
    flex-basis: 30px;
    width: 30px;
    height: 30px;
  }

  .agent-trace-line {
    top: 30px;
  }

  .agent-trace-title {
    font-size: 15px;
  }

  .agent-trace-summary-text,
  .trace-model-monologue-copy p,
  .trace-detail-label,
  .trace-section-text,
  .trace-kv-item,
  .trace-tool-copy strong,
  .trace-error-text {
    font-size: 14px;
  }

  .agent-trace-branch {
    margin-left: 10px;
    padding-left: 14px;
  }

  .trace-detail-tree {
    margin-left: 6px;
    padding-left: 14px;
  }

  .trace-detail-item::before {
    left: -14px;
    width: 10px;
  }

  .trace-detail-content {
    margin-left: 24px;
  }

  .trace-kv-grid {
    grid-template-columns: 1fr;
  }

  .trace-kv-item {
    grid-template-columns: minmax(68px, max-content) minmax(0, 1fr);
  }

  .trace-tool-row {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .trace-tool-source {
    width: 100%;
  }

  .trace-code-block {
    max-height: 300px;
    padding: 11px;
    font-size: 12.5px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .agent-process-mark.running,
  .agent-trace-spinner,
  .agent-process-title.is-running,
  .agent-process-current-action {
    animation: none;
  }

  .agent-process-title.is-running {
    color: #edf2f7;
    background: none;
    -webkit-background-clip: initial;
    background-clip: initial;
  }

  .agent-process-chevron,
  .agent-trace-chevron,
  .trace-detail-chevron {
    transition: none;
  }
}
</style>
