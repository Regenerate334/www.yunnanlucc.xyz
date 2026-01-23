<template>
  <Teleport to="body">
    <transition name="modal-fade">
      <div v-if="visible" class="ai-modal-overlay" @click.self="handleClose">
        <div class="ai-modal-container" :class="{ fullscreen: isFullscreen }">
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
                  :class="{ active: currentSessionId === session.id }" @click="selectSession(session.id)">
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
              <button class="fullscreen-btn" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏'">
                <svg v-if="!isFullscreen" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path
                    d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path
                    d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
              </button>
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
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          stroke-width="2">
                          <rect x="6" y="6" width="12" height="12" rx="2" />
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
                    v-if="msg.role === 'assistant' && (parseMessage(msg.content).thinking || (loading && index === messages.length - 1))"
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
                        <span v-if="loading && index === messages.length - 1">Thinking...</span>
                        <span v-else>Thought for {{ msg.thinkTime || 'a few' }} seconds</span>
                      </div>
                    </div>
                    <transition name="fade">
                      <div v-if="expandedThinking[index]" class="thinking-content">
                        {{ parseMessage(msg.content).thinking }}
                      </div>
                    </transition>
                  </div>

                  <!-- 消息正文 -->
                  <div class="bubble" v-if="parseMessage(msg.content).content">
                    <div v-if="msg.role === 'assistant'" class="markdown-body"
                      v-html="renderMarkdown(parseMessage(msg.content).content)"></div>
                    <div v-else>{{ msg.content }}</div>
                  </div>

                  <!-- 操作按钮 (仅 AI) -->
                  <div v-if="msg.role === 'assistant' && parseMessage(msg.content).content" class="message-actions">
                    <button class="action-btn" @click="copyMessage(msg.content)" title="复制内容">
                      <svg class="copy-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
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
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
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

const getParsedMessage = (content) => {
  if (!content) return { thinking: '', content: '' };
  if (parseCache.has(content)) return parseCache.get(content);

  const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
  const thinking = thinkMatch ? thinkMatch[1].trim() : '';

  let cleanContent = content.replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*/gi, '')
    .trim();

  const result = { thinking, content: cleanContent };
  if (parseCache.size > 100) parseCache.clear();
  parseCache.set(content, result);
  return result;
};

const getRenderedMarkdown = (text) => {
  if (!text) return '';
  if (renderCache.has(text)) return renderCache.get(text);

  const result = md.render(text);
  if (renderCache.size > 100) renderCache.clear();
  renderCache.set(text, result);
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

// 深度思考配置
const deepThinking = ref(true);

// 模型选择
const isFullscreen = ref(false);
const selectedModel = ref('gpt-oss:20b');

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
};
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

  // 立即更新前端会话标题（如果是第一条消息）
  const currentSession = sessions.value.find(s => s.id === currentSessionId.value);
  if (currentSession && (currentSession.title === '新对话' || !currentSession.title)) {
    currentSession.title = userMessage.length > 30 ? userMessage.substring(0, 27) + '...' : userMessage;
  }

  await scrollToBottom();
  loading.value = true;
  abortController.value = new AbortController();

  const assistantMsgIndex = messages.value.length;
  const startTime = Date.now();
  messages.value.push({
    role: 'assistant',
    content: '',
    thinkTime: 0
  });

  expandedThinking.value[assistantMsgIndex] = false;

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
        deepThinking: deepThinking.value,
        model: selectedModel.value
      },
      (chunk) => {
        messages.value[assistantMsgIndex].content += chunk;

        const parsed = parseMessage(messages.value[assistantMsgIndex].content);
        if (parsed.content && !messages.value[assistantMsgIndex].thinkTime) {
          messages.value[assistantMsgIndex].thinkTime = ((Date.now() - startTime) / 1000).toFixed(1);
        }

        scrollToBottom();
      },
      async () => {
        loading.value = false;
        abortController.value = null;
        // 完成后保存 AI 消息
        await saveMessage('assistant', messages.value[assistantMsgIndex].content);
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
  expandedThinking.value[index] = !expandedThinking.value[index];
};

const parseMessage = getParsedMessage;
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
    if (lastMsg.role === 'assistant' && parseMessage(lastMsg.content).thinking && expandedThinking.value[lastIndex] === undefined) {
      expandedThinking.value[lastIndex] = false;
    }
  }
}, { deep: true });
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
  width: 60vw;
  max-width: 1200px;
  height: 85vh;
  background: rgba(13, 25, 48, 0.75);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  display: flex;
  overflow: visible;
  box-shadow: 0 25px 80px -12px rgba(0, 0, 0, 0.6);
  position: relative;
  border: 1px solid rgba(59, 130, 246, 0.2);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.ai-modal-container.fullscreen {
  width: 95vw;
  height: 95vh;
  max-width: none;
}

/* 全屏模式下的响应式调整 */
.ai-modal-container.fullscreen .welcome-container {
  max-width: 900px;
}

.ai-modal-container.fullscreen .message {
  max-width: 1100px;
}

.ai-modal-container.fullscreen .markdown-body :deep(table) {
  max-width: 100%;
}

.ai-modal-container.fullscreen .input-pill {
  max-width: 900px;
  margin: 0 auto;
}

.ai-modal-container.fullscreen .ai-modal-footer .input-pill {
  max-width: 1000px;
}

.fullscreen-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 4px;
  cursor: pointer;
  margin-right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
  border-radius: 4px;
}

.fullscreen-btn:hover {
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.05);
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
  background: rgba(13, 25, 48, 0.3);
  border-top-right-radius: 16px;
  border-bottom-right-radius: 16px;
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
  left: 0;
  min-width: 200px;
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
  background: #ef4444;
  color: white;
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
  width: 100%;
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
  padding: 4px 0;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  cursor: pointer;
  font-size: 14px;
  color: #94a3b8;
  user-select: none;
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

.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 20px 0;
  background: rgba(30, 41, 59, 0.3);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px 16px;
  text-align: left;
}

.markdown-body :deep(th) {
  background: rgba(59, 130, 246, 0.1);
  color: #93c5fd;
  font-weight: 600;
}

.markdown-body :deep(tr:hover) {
  background: rgba(255, 255, 255, 0.02);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .ai-modal-container,
.modal-fade-leave-to .ai-modal-container {
  transform: scale(0.92) translateY(20px);
  opacity: 0;
}

.ai-modal-container {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
