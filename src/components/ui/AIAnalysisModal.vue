<template>
  <Teleport to="body">
    <transition name="modal-fade">
      <div v-if="visible" class="ai-modal-overlay" @click.self="handleClose">
        <div class="ai-modal-container">
          <!-- Sidebar -->
          <div class="sidebar">
            <div class="sidebar-header">
              <button class="new-chat-btn" @click="createNewSession">
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

          <!-- Main Content -->
          <div class="main-content">
            <!-- Header (Close Button Only) -->
            <div class="ai-modal-header">
              <button class="close-btn" @click="handleClose" title="关闭">×</button>
            </div>

            <!-- 消息区域 -->
            <div class="ai-modal-body" :class="{ 'no-scroll': messages.length === 0 }" ref="messagesContainer">
              <!-- 欢迎界面 (新对话) -->
              <div v-if="messages.length === 0" class="welcome-container">
                <div class="welcome-section">
                  <ChatGptIcon :size="160" color="#ffffff" class="welcome-logo" />
                  <h1 class="welcome-title">土地利用智能分析助手</h1>
                  <p class="welcome-subtitle">基于 AI 大模型，为您提供专业的土地利用变化分析与决策支持</p>
                </div>

                <!-- 居中的输入框 -->
                <div class="centered-input-wrapper">
                  <div class="input-pill">
                    <div class="input-area">
                      <textarea v-model="inputText" placeholder="Send a message..." @keydown.enter.prevent="handleEnter"
                        :disabled="loading" rows="1" ref="inputField"></textarea>
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
                          <div v-if="showModelDropdown" class="model-dropdown-menu">
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

                <!-- 快捷问题两行滚动播放 -->
                <div class="questions-scroll-wrapper">
                  <!-- 第一行：向左滚动 -->
                  <div class="questions-scroll-track scroll-left">
                    <button v-for="(q, i) in quickQuestions.slice(0, Math.ceil(quickQuestions.length / 2))"
                      :key="'a1-' + i" class="quick-btn" @click="sendMessage(q)">
                      {{ q }}
                    </button>
                    <button v-for="(q, i) in quickQuestions.slice(0, Math.ceil(quickQuestions.length / 2))"
                      :key="'a2-' + i" class="quick-btn" @click="sendMessage(q)">
                      {{ q }}
                    </button>
                  </div>
                  <!-- 第二行：向右滚动 -->
                  <div class="questions-scroll-track scroll-right">
                    <button v-for="(q, i) in quickQuestions.slice(Math.ceil(quickQuestions.length / 2))"
                      :key="'b1-' + i" class="quick-btn" @click="sendMessage(q)">
                      {{ q }}
                    </button>
                    <button v-for="(q, i) in quickQuestions.slice(Math.ceil(quickQuestions.length / 2))"
                      :key="'b2-' + i" class="quick-btn" @click="sendMessage(q)">
                      {{ q }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- 对话消息 -->
              <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
                <div class="bubble-wrapper">
                  <!-- 思考过程 (仅 AI) -->
                  <div
                    v-if="msg.role === 'assistant' && (parseMessage(msg).thinking || (loading && index === messages.length - 1))"
                    class="thinking-process">
                    <div class="thinking-header" @click="toggleThinking(index)">
                      <div class="thinking-title">
                        <!-- 展开时显示向下箭头 -->
                        <svg v-if="expandedThinking[index]" class="arrow-icon-svg" width="16" height="16"
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                          stroke-linejoin="round">
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                        <!-- 折叠时显示灯泡 -->
                        <svg v-else class="thinking-icon-svg"
                          :class="{ 'is-thinking': loading && index === messages.length - 1 }" width="16" height="16"
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                          stroke-linejoin="round">
                          <path d="M9 18h6"></path>
                          <path d="M10 22h4"></path>
                          <path
                            d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z">
                          </path>
                        </svg>
                        <span v-if="loading && index === messages.length - 1">AI 正在深度思考...</span>
                        <span v-else>耗时 {{ msg.thinkTime || '几' }} 秒完成分析</span>
                      </div>
                    </div>
                    <transition name="fade">
                      <div v-if="expandedThinking[index]" class="thinking-content">
                        {{ parseMessage(msg).thinking }}
                      </div>
                    </transition>
                  </div>

                  <!-- 工业级状态步进器 (Industrial Progress Stepper) -->
                  <div v-if="msg.role === 'assistant' && parseMessage(msg).statuses.length > 0" class="industrial-stepper">
                    <div v-for="(status, sIdx) in parseMessage(msg).statuses" :key="sIdx"
                      :class="['step-item', status.type, status.done ? 'done' : 'active']">
                      <div class="step-line" v-if="sIdx < parseMessage(msg).statuses.length - 1"></div>
                      <div class="step-indicator">
                        <div class="step-icon" v-html="status.icon"></div>
                        <div class="step-pulse" v-if="!status.done"></div>
                      </div>
                      <div class="step-content">
                        <div class="step-label">{{ status.label }}</div>
                        <div class="step-detail" v-if="status.detail">{{ status.detail }}</div>
                      </div>
                    </div>
                  </div>

                  <!-- 消息正文 -->
                  <div class="bubble" v-if="parseMessage(msg).content">
                    <div v-if="msg.role === 'assistant'" class="markdown-body"
                      v-html="renderMarkdown(parseMessage(msg).content, loading && index === messages.length - 1)"></div>
                    <div v-else>{{ msg.content }}</div>
                  </div>

                  <!-- 操作按钮 (仅 AI) -->
                  <div v-if="msg.role === 'assistant' && parseMessage(msg).content" class="message-actions">
                    <button class="action-btn" @click="copyMessage(msg.content)" title="复制内容">
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
                    :disabled="loading" rows="1" ref="inputField"></textarea>
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
                      <div v-if="showModelDropdown" class="model-dropdown-menu">
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
        </div>
      </div>
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
import { analyzeDataStream, generateQuickQuestions } from '@/utils/aiService.js';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import ChatGptIcon from '@/components/icons/ChatGptIcon.vue';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' +
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
          '</code></pre>';
      } catch (__) { }
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
  }
}).use(texmath, {
  engine: katex,
  delimiters: 'dollars',
  katexOptions: { throwOnError: false, displayMode: false }
});

const parseCache = new Map();
const renderCache = new Map();

const _parseMessage = (msg) => {
  if (!msg) return { thinking: '', content: '', statuses: [] };
  
  let thinking = msg.thinking || '';
  let content = msg.content || '';
  const cacheKey = typeof msg === 'string' ? msg : (msg.content || '') + (msg.thinking || '');

  if (parseCache.has(cacheKey)) return parseCache.get(cacheKey);

  // 1. 解析 <think> 标签
  if (content.includes('<think>')) {
    const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
    if (thinkMatch) {
      thinking = (thinking ? thinking + '\n' : '') + thinkMatch[1].trim();
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<think>[\s\S]*/gi, '')
        .trim();
    }
  }

  // 2. 解析 [SEARCH] 和 [ANALYSIS] 状态标签 (工业级去重解析)
  const statuses = [];
  const checkIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  const searchIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
  const analysisIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`;

  const hasAnalysis = content.includes('[ANALYSIS]');
  const isSearchDone = hasAnalysis || !loading.value;
  
  // 使用 Set 记录已处理的 detail，防止流式输出中的正则重复匹配导致的 UI 抽搐
  const seenDetails = new Set();

  // 匹配 [SEARCH]
  const searchMatches = content.match(/\[SEARCH\].*?(\n|$)/g);
  if (searchMatches) {
    searchMatches.forEach(match => {
      const detail = match.replace(/\[SEARCH\]\s*/, '').trim();
      if (detail && !seenDetails.has(detail)) {
        statuses.push({
          type: 'search',
          done: isSearchDone,
          label: isSearchDone ? '检索完成' : '智能检索中',
          detail,
          icon: isSearchDone ? checkIcon : searchIcon
        });
        seenDetails.add(detail);
      }
    });
  }

  // 匹配 [ANALYSIS]
  const analysisMatches = content.match(/\[ANALYSIS\].*?(\n|$)/g);
  if (analysisMatches) {
    analysisMatches.forEach(match => {
      const detail = match.replace(/\[ANALYSIS\]\s*/, '').trim();
      if (detail && !seenDetails.has(detail)) {
        const isDone = !loading.value;
        statuses.push({
          type: 'analysis',
          done: isDone,
          label: isDone ? '分析完成' : '深度分析中',
          detail,
          icon: isDone ? checkIcon : analysisIcon
        });
        seenDetails.add(detail);
      }
    });
  }

  // 3. 从正文中移除这些标签
  const cleanContent = content
    .replace(/\[SEARCH\].*?(\n|$)/g, '')
    .replace(/\[ANALYSIS\].*?(\n|$)/g, '')
    .trim();

  const result = { thinking, content: cleanContent, statuses };
  if (parseCache.size > 100) parseCache.clear();
  parseCache.set(cacheKey, result);
  return result;
};

const getRenderedMarkdown = (text) => {
  if (!text) return '';
  const cacheKey = text;
  if (renderCache.has(cacheKey)) return renderCache.get(cacheKey);

  let result = md.render(text);
  
  // 给 table 增加包装层
  result = result.replace(/<table>/g, '<div class="table-container"><table>').replace(/<\/table>/g, '</table></div>');

  if (renderCache.size > 200) renderCache.clear();
  renderCache.set(cacheKey, result);
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

// 会话管理状态
const sessions = ref([]);
const currentSessionId = ref(null);

const loadSessions = async () => {
  console.log('[Sessions] Loading sessions...');
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
      console.log('[Sessions] Loaded:', sessions.value.length);
    }
  } catch (err) {
    console.error('[Sessions] Load failed:', err);
  }
};

const createNewSession = async () => {
  console.log('[Sessions] Creating new session...');
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
      console.log('[Sessions] Created:', data.session.id);
      currentSessionId.value = data.session.id;
      messages.value = [];
      expandedThinking.value = {}; // 重置折叠状态
      await loadSessions();
    }
  } catch (err) {
    console.error('[Sessions] Create failed:', err);
  }
};

const selectSession = async (sessionId) => {
  if (currentSessionId.value === sessionId) return;
  console.log('[Sessions] Selecting session:', sessionId);
  currentSessionId.value = sessionId;
  messages.value = [];
  expandedThinking.value = {}; // 清空之前的展开状态，防止索引错乱
  loading.value = false;
  stopGeneration();

  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`/api/chat-sessions/${sessionId}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data.success) {
      messages.value = data.messages;
      console.log('[Sessions] Messages loaded:', messages.value.length);
      nextTick(() => scrollToBottom(true));
    }
  } catch (err) {
    console.error('[Sessions] Load messages failed:', err);
  }
};

const deleteSession = async (sessionId) => {
  if (!confirm('确定要删除这个对话吗？')) return;
  console.log('[Sessions] Deleting session:', sessionId);

  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`/api/chat-sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data.success) {
      console.log('[Sessions] Deleted successfully');
      await loadSessions();
      if (currentSessionId.value === sessionId) {
        if (sessions.value.length > 0) {
          await selectSession(sessions.value[0].id);
        } else {
          await createNewSession();
        }
      }
    }
  } catch (err) {
    console.error('[Sessions] Delete failed:', err);
  }
};

const saveMessage = async (role, content) => {
  if (!currentSessionId.value) return;
  try {
    await fetch(`/api/chat-sessions/${currentSessionId.value}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: JSON.stringify({ role, content })
    });
  } catch (err) {
    console.error('保存消息失败:', err);
  }
};

// 深度思考配置（改为自动识别）
const THINKING_MODELS = ['deepseek-r1', 'gpt-oss:120b', 'gpt-oss:20b', 'r1'];
const isReasoningModel = computed(() => {
  return THINKING_MODELS.some(m => selectedModel.value.toLowerCase().includes(m));
});

const deepThinking = computed(() => isReasoningModel.value);

// 模型选择
const selectedModel = ref('gpt-oss:120b-cloud');
const showModelDropdown = ref(false);
const availableModels = [
  { value: 'gpt-oss:120b-cloud', label: 'GPT-OSS 120B (Cloud)', desc: '云端超大模型 · 最强推理能力' },
  { value: 'gpt-oss:20b', label: 'GPT-OSS 20B', desc: '高性能模式 · 适合复杂分析' },
  { value: 'deepseek-r1:8b', label: 'DeepSeek-R1 8B', desc: '标准模式 · 性能平衡' },
  { value: 'gemma3:4b', label: 'Gemma 3 4B', desc: '快速模式 · 响应灵敏' },
  { value: 'deepseek-r1:1.5b', label: 'DeepSeek-R1 1.5B', desc: '极速模式 · 秒级响应' }
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
});

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside);
  // 组件卸载时取消正在进行的请求
  if (abortController.value) {
    console.log('[AI Modal] 组件卸载，取消正在进行的请求');
    abortController.value.abort();
    abortController.value = null;
  }
});

const quickQuestions = computed(() => {
  return generateQuickQuestions(props.analysisType, {
    region: props.region,
    year: props.year
  });
});

watch(() => props.visible, async (visible) => {
  if (visible) {
    await loadSessions();
    // 如果没有活跃会话，自动创建一个
    if (sessions.value.length === 0 && !currentSessionId.value) {
      await createNewSession();
    } else if (!currentSessionId.value && sessions.value.length > 0) {
      await selectSession(sessions.value[0].id);
    }

    nextTick(() => {
      inputField.value?.focus();
    });
  }
});

const handleClose = () => {
  console.log('[AI Modal] 关闭对话框');
  // 关闭时取消正在进行的请求
  if (abortController.value) {
    console.log('[AI Modal] 关闭时取消正在进行的请求');
    abortController.value.abort();
    abortController.value = null;
    loading.value = false;
  }
  emit('update:visible', false);
  emit('close');
};

const handleEnter = (e) => {
  if (!e.shiftKey) {
    sendMessage(inputText.value);
  }
};

const stopGeneration = () => {
  if (abortController.value) {
    console.log('[AI Modal] 用户点击停止生成');
    abortController.value.abort();
    abortController.value = null;
    loading.value = false;
  }
};

const clearMessages = () => {
  createNewSession();
};

const sendMessage = async (text) => {
  if (!text || !text.trim() || loading.value) return;

  const userMessage = text.trim();
  inputText.value = '';

  messages.value.push({
    role: 'user',
    content: userMessage
  });

  // 移除前端手动更新标题的逻辑，完全交给后端 AI 处理
  await scrollToBottom();
  loading.value = true;
  abortController.value = new AbortController();

  const assistantMsgIndex = messages.value.length;
  const startTime = Date.now();
  messages.value.push({
    role: 'assistant',
    content: '',
    thinking: '',
    thinkTime: 0
  });

  // 初始自动展开
  expandedThinking.value[assistantMsgIndex] = true;
  const userInteractedThinking = ref(false); // 追踪用户是否手动调整过折叠状态

  try {
    // 发送前保存用户消息
    await saveMessage('user', userMessage);

    // 调试: 打印传递给AI的数据
    console.log('[AI Modal] 传递的数据:', {
      year: props.year,
      region: props.region,
      contextType: props.componentContext?.type,
      landDataType: Array.isArray(props.landData) ? 'Array' : typeof props.landData,
      landDataLength: Array.isArray(props.landData) ? props.landData.length : Object.keys(props.landData).length
    });

    await analyzeDataStream(
      {
        messages: messages.value.slice(0, -1),
        year: props.year,
        landData: props.landData,
        componentContext: props.componentContext,
        region: props.region,
        deepThinking: isReasoningModel.value,
        model: selectedModel.value
      },
      (chunkObj) => {
        if (chunkObj.content) {
          messages.value[assistantMsgIndex].content += chunkObj.content;
          // 只有用户没动过，我们才根据内容自动控制展开
          if (chunkObj.content.includes('<think>') && !userInteractedThinking.value) {
            expandedThinking.value[assistantMsgIndex] = true;
          }
        }
        if (chunkObj.thinking) {
          messages.value[assistantMsgIndex].thinking += chunkObj.thinking;
          // 收到推理分块，且用户没动过，确保展开
          if (!userInteractedThinking.value) {
            expandedThinking.value[assistantMsgIndex] = true;
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

        // 完成后保存 AI 消息
        await saveMessage('assistant', lastMsg.content);
        
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
      },
      abortController.value.signal
    );
  } catch (err) {
    loading.value = false;
    abortController.value = null;
  }
  await scrollToBottom();
};

const lastScrollTime = ref(0);
const scrollToBottom = async (force = false) => {
  const now = Date.now();
  if (!force && now - lastScrollTime.value < 100) return;

  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    lastScrollTime.value = now;
  }
};



const toggleThinking = (index) => {
  if (expandedThinking.value[index] === undefined) {
    expandedThinking.value[index] = true;
  }
  expandedThinking.value[index] = !expandedThinking.value[index];
  
  // 如果是当前正在生成的 AI 消息，记录用户交互
  if (loading.value && index === messages.value.length - 1) {
    userInteractedThinking.value = true;
  }
};

const parseMessage = _parseMessage;
const renderMarkdown = getRenderedMarkdown;

const copyMessage = (text) => {
  const { content } = parseMessage(text);
  navigator.clipboard.writeText(content).then(() => {
    alert('内容已复制到剪贴板');
  });
};

watch(messages, (newMsgs) => {
  if (newMsgs.length > 0) {
    const lastIndex = newMsgs.length - 1;
    const lastMsg = newMsgs[lastIndex];
    if (lastMsg.role === 'assistant' && parseMessage(lastMsg).thinking && expandedThinking.value[lastIndex] === undefined) {
      expandedThinking.value[lastIndex] = true;
    }
  }
}, { deep: true });

// ── 报告生成逻辑（纯前端，无二次AI调用）─────────────────────────────────────

const reportVisible  = ref(false);
const reportLoading  = ref(false);
const reportHtmlUrl  = ref('');   // Blob URL
const reportError    = ref('');
const reportIframe   = ref(null);
const lastReportMsgSlice = ref(null);

/**
 * 将 Markdown 文本转为完整优化排版的 HTML 报告字符串。
 * 无需任何后端调用。
 */
const buildDirectReportHtml = (title, markdownContent, meta) => {
  // 把已有的 renderMarkdown 转换Markdown → HTML
  const bodyHtml = renderMarkdown(markdownContent);
  const now = new Date().toLocaleString('zh-CN', { hour12: false });
  const regionInfo = [meta.region, meta.year ? `${meta.year}年` : ''].filter(Boolean).join(' · ');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Noto+Sans+SC:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    /* ── 全局重置 ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
      font-size: 14px;
      line-height: 1.8;
      color: #1a202c;
      background: #f7f8fa;
    }

    /* ── 页面容器 ── */
    .report-page {
      max-width: 860px;
      margin: 40px auto;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      overflow: hidden;
    }

    /* ── 页眉 ── */
    .report-header {
      background: linear-gradient(135deg, #1a365d 0%, #2a4a8a 100%);
      color: #fff;
      padding: 40px 52px 36px;
    }
    .report-header .tag {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.55);
      margin-bottom: 16px;
    }
    .report-header h1 {
      font-family: 'Noto Serif SC', serif;
      font-size: 28px;
      font-weight: 700;
      line-height: 1.3;
      color: #fff;
      margin-bottom: 12px;
    }
    .report-header .meta {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    .report-header .meta span::before {
      content: '▪ ';
      opacity: 0.4;
    }

    /* ── 主体内容 ── */
    .report-body {
      padding: 44px 52px 52px;
    }

    /* ── Markdown 内容排版 ── */
    .md-content h1, .md-content h2, .md-content h3,
    .md-content h4, .md-content h5, .md-content h6 {
      font-family: 'Noto Serif SC', serif;
      color: #1a365d;
      margin-top: 2em;
      margin-bottom: 0.6em;
      line-height: 1.4;
    }
    .md-content h1 { font-size: 22px; border-bottom: 2px solid #2a4a8a; padding-bottom: 8px; }
    .md-content h2 { font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    .md-content h3 { font-size: 16px; }
    .md-content h4, .md-content h5, .md-content h6 { font-size: 14px; }

    .md-content p {
      margin-bottom: 1em;
      text-align: justify;
      color: #2d3748;
    }

    /* ── 强调文字 ── */
    .md-content strong { color: #1a365d; font-weight: 600; }
    .md-content em { color: #4a5568; font-style: italic; }

    /* ── 列表 ── */
    .md-content ul, .md-content ol {
      padding-left: 1.6em;
      margin-bottom: 1em;
    }
    .md-content li {
      margin-bottom: 0.4em;
      color: #2d3748;
    }
    .md-content li > ul, .md-content li > ol {
      margin-top: 0.3em;
      margin-bottom: 0;
    }

    /* ── 表格容器（对应 getRenderedMarkdown 生成的 .table-container 包装层）── */
    .md-content .table-container {
      overflow-x: auto;
      margin: 1.4em 0;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }

    /* ── 表格（核心优化）── */
    .md-content table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin: 0;
    }
    .md-content thead tr {
      background: #1a365d;
      color: #fff;
    }
    .md-content th {
      padding: 10px 14px;
      font-weight: 600;
      text-align: left;
      white-space: nowrap;
    }
    .md-content td {
      padding: 9px 14px;
      border-bottom: 1px solid #e2e8f0;
      color: #2d3748;
    }
    .md-content tbody tr:nth-child(even) {
      background: #f7f8fa;
    }
    .md-content tbody tr:hover {
      background: #ebf4ff;
    }

    /* ── 引用块 ── */
    .md-content blockquote {
      border-left: 4px solid #2a4a8a;
      background: #ebf4ff;
      margin: 1.2em 0;
      padding: 12px 18px;
      border-radius: 0 6px 6px 0;
      color: #2c5282;
    }
    .md-content blockquote p { margin: 0; color: inherit; }

    /* ── 代码 ── */
    .md-content code {
      background: #edf2f7;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 12px;
      font-family: 'JetBrains Mono', 'Consolas', monospace;
      color: #c53030;
    }
    .md-content pre {
      background: #1a202c;
      color: #e2e8f0;
      padding: 16px 20px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1.2em 0;
      font-size: 12px;
      line-height: 1.6;
    }
    .md-content pre code {
      background: none;
      padding: 0;
      color: inherit;
      font-size: inherit;
    }

    /* ── 分割线 ── */
    .md-content hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 2em 0;
    }

    /* ── 页脚 ── */
    .report-footer {
      border-top: 1px solid #e2e8f0;
      padding: 18px 52px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #a0aec0;
      background: #fafbfc;
    }

    /* ── 打印样式 ── */
    @media print {
      body { background: #fff; }
      .report-page {
        margin: 0;
        box-shadow: none;
        border-radius: 0;
        max-width: 100%;
      }
      .report-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .md-content thead tr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .md-content tbody tr:nth-child(even) { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .md-content h1, .md-content h2 { page-break-after: avoid; }
      .md-content table, .md-content pre { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="report-page">
    <div class="report-header">
      <div class="tag">AI 分析报告 · GIS Intelligence Platform</div>
      <h1>${title}</h1>
      <div class="meta">
        ${regionInfo ? `<span>${regionInfo}</span>` : ''}
        <span>生成时间：${now}</span>
      </div>
    </div>
    <div class="report-body">
      <div class="md-content">${bodyHtml}</div>
    </div>
    <div class="report-footer">
      <span>© GIS 智能分析平台</span>
      <span>${now}</span>
    </div>
  </div>
</body>
</html>`;
};

/**
 * 核心：直接从已有AI对话提取内容生成报告，无需二次调用AI。
 * @param {Array} msgSlice - 截至当前消息的对话记录
 */
const generateReport = (msgSlice) => {
  const lastUserMsg      = [...msgSlice].reverse().find(m => m.role === 'user');
  const lastAssistantMsg = [...msgSlice].reverse().find(m => m.role === 'assistant');

  if (!lastUserMsg || !lastAssistantMsg) return;

  // 标题：取用户问题前 40 字
  const title = lastUserMsg.content.trim().slice(0, 40) + (lastUserMsg.content.trim().length > 40 ? '...' : '');

  // 内容：AI 回复的纯 Markdown（去掉 <think> 思考块）
  const markdownContent = parseMessage(lastAssistantMsg).content;

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
    const html = buildDirectReportHtml(title, markdownContent, {
      region: props.region,
      year:   props.year
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
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-modal-container {
  width: 95vw;
  height: 90vh;
  max-width: 1600px; /* 恢复 1600px 大尺寸窗口 */
  background: #0f172a;
  border-radius: 24px;
  display: flex;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
  transition: all 0.3s ease;
}

/* 全屏模式下的响应式调整 */
.ai-modal-container.fullscreen .welcome-container {
  max-width: 900px;
}

.sidebar {
  width: 260px;
  background: rgba(15, 23, 42, 0.6);
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  padding: 16px;
  transition: all 0.3s ease;
  border-top-left-radius: 16px;
  border-bottom-left-radius: 16px;
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
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  background: #0d1930;
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
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
  padding: 4px;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #f1f5f9;
}

.ai-modal-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
  padding-bottom: 200px;
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
  letter-spacing: 1px;
  text-align: center;
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
  max-width: 850px; /* 限制输入框宽度，防止在宽屏上过度伸展 */
  margin: 0 auto;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 16px;
  padding: 12px 16px;
  transition: all 0.3s ease;
}

.input-pill:focus-within {
  border-color: rgba(59, 130, 246, 0.5);
  background: rgba(30, 41, 59, 0.8);
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.1);
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
  max-height: 200px;
}

.input-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
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
  min-width: 240px;
  background: #1e293b;
  border: 1px solid rgba(59, 130, 246, 0.5);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
  overflow: hidden;
  z-index: 99999;
  backdrop-filter: blur(10px);
  pointer-events: all;
}

.welcome-container .model-dropdown-menu {
  bottom: auto;
  top: calc(100% + 8px);
  right: 0;
  left: auto;
}

.model-dropdown-item {
  padding: 10px 16px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
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
  /* 两行滚动区域 - 向两侧对称扩展 */
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
  max-width: 850px;
  margin: 0 auto;
}

.message.user {
  align-items: flex-end;
  /* 用户消息右对齐 */
  margin-bottom: 32px;
}

.bubble-wrapper {
  max-width: 1000px; /* 恢复 1000px 的消息输出宽度 */
  width: 100%;
  margin: 0 auto;
}

.message.user .bubble-wrapper {
  width: auto;
  max-width: 80%;
  display: flex;
  justify-content: flex-end;
}

.bubble {
  padding: 0;
  background: transparent;
  border: none;
  font-size: 16px;
  line-height: 1.8;
  color: #e2e8f0;
  text-align: justify;
  text-justify: inter-word;
}

.user .bubble {
  color: #ffffff;
  background: #3b82f6;
  /* 蓝色背景 */
  padding: 12px 20px;
  border-radius: 16px 16px 4px 16px;
  /* 气泡圆角 */
  font-weight: 500;
  font-size: 16px;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  text-align: left;
}

.assistant .bubble {
  color: #e2e8f0;
}

.thinking-process {
  background: transparent;
  border-radius: 0;
  margin-bottom: 8px;
  border: none;
}

.thinking-header {
  padding: 6px 0;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  cursor: pointer;
  font-size: 14px;
  color: #94a3b8;
  user-select: none;
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

.thinking-icon-svg.is-thinking {
  color: #fbbf24;
  filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.4));
  animation: pulse 2s infinite;
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
  margin-top: 8px;
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
  padding: 4px 0 12px 24px;
  font-size: 14px;
  color: #94a3b8;
  white-space: pre-wrap;
  line-height: 1.6;
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
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20px;
  padding-top: 40px;
  border-top: none;
  background: linear-gradient(to top, rgba(13, 25, 48, 1) 70%, rgba(13, 25, 48, 0) 100%);
  z-index: 10;
  overflow: visible !important;
}

.footer-hint {
  margin-top: 12px;
  text-align: center;
  font-size: 12px;
  color: #64748b;
}

/* Markdown 渲染优化 */
.markdown-body {
  font-size: 16px;
  line-height: 1.8;
  color: #e2e8f0;
  text-align: justify;
  text-justify: inter-word;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  color: #f1f5f9;
  margin-top: 32px;
  margin-bottom: 16px;
  font-weight: 600;
  text-align: left;
  /* 标题保持左对齐 */
}

.markdown-body :deep(p) {
  margin-bottom: 16px;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 20px;
  margin-bottom: 16px;
}

.markdown-body :deep(li) {
  margin-bottom: 8px;
}

.markdown-body :deep(strong) {
  color: #60a5fa;
}

/* 表格容器：支持居中与滚动 */
.markdown-body :deep(.table-container) {
  width: 100%;
  display: flex;
  justify-content: center;
  overflow-x: auto;
  margin: 24px 0;
  padding: 4px; /* 给阴影留点空间 */
}

.markdown-body :deep(table) {
  border-collapse: separate;
  border-spacing: 0;
  width: auto;
  min-width: 300px;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 0.5px solid rgba(255, 255, 255, 0.05);
  padding: 8px 16px;
  text-align: center;
  font-size: 14px;
  white-space: normal;
  word-wrap: break-word;
  word-break: break-all;
  min-width: 80px;
  max-width: 400px; /* 适当放宽单元格限制，但在 1000px 容器内依然强制换行 */
}

.markdown-body :deep(th) {
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
  font-weight: 600;
  border-bottom: 1px solid rgba(59, 130, 246, 0.3);
}

.markdown-body :deep(tr:last-child td:first-child) { border-bottom-left-radius: 12px; }
.markdown-body :deep(tr:last-child td:last-child) { border-bottom-right-radius: 12px; }

.markdown-body :deep(tr:hover) {
  background: rgba(255, 255, 255, 0.03);
}

/* ── AI 步进器 (Industrial Progress Stepper) ────────────────────────────────── */
.industrial-stepper {
  margin: 12px 0 20px 4px;
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
}

.step-item {
  display: flex;
  gap: 16px;
  position: relative;
  padding-bottom: 20px;
  opacity: 0;
  transform: translateX(-10px);
  animation: stepAppear 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes stepAppear {
  to { opacity: 1; transform: translateX(0); }
}

.step-item:last-child {
  padding-bottom: 0;
}

.step-line {
  position: absolute;
  left: 11px;
  top: 24px;
  bottom: -4px;
  width: 2px;
  background: rgba(255, 255, 255, 0.08);
  z-index: 1;
}

.step-indicator {
  position: relative;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-icon {
  width: 100%;
  height: 100%;
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  transition: all 0.3s ease;
}

.step-item.done .step-icon {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.4);
  color: #10b981;
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.2);
}

.step-item.active .step-icon {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.4);
  color: #60a5fa;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.2);
}

.step-pulse {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid rgba(59, 130, 246, 0.3);
  animation: stepPulse 2s infinite;
}

@keyframes stepPulse {
  0% { transform: scale(0.8); opacity: 0; }
  50% { opacity: 0.5; }
  100% { transform: scale(1.5); opacity: 0; }
}

.step-content {
  padding-top: 2px;
}

.step-label {
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 4px;
  font-family: "PingFang SC", sans-serif;
}

.step-item.done .step-label {
  color: #10b981;
}

.step-detail {
  font-size: 13px;
  color: #64748b;
  font-family: "JetBrains Mono", monospace;
  background: rgba(0, 0, 0, 0.15);
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.ai-modal-container {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
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
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 22px;
  line-height: 1;
  padding: 2px 6px;
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.15s;
}

.report-close-btn:hover { color: #e2e8f0; }

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
</style>
