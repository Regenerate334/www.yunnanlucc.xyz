<template>
  <div class="ai-panel-container">
    <!-- 消息列表 -->
    <div class="messages-container" ref="messagesContainer">
      <div v-if="messages.length === 0" class="empty-state">
        <div class="ai-avatar-icon">
          <ChatGptIcon :size="48" color="#3b82f6" class="empty-logo" />
        </div>
        <p>你好！我是土地利用分析 AI 助手</p>
        <p class="sub-text">选择下方问题或输入您的问题</p>
        <!-- 快捷问题 -->
        <div class="quick-actions">
          <button v-for="(q, i) in suggestions" :key="i" class="quick-btn" @click="sendMessage(q)">
            {{ q }}
          </button>
        </div>
      </div>

      <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
        <div class="avatar">
          <svg v-if="msg.role === 'user'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <ChatGptIcon v-else :size="24" color="#3b82f6" class="avatar-img" />
        </div>
        <div class="content">
          <!-- 深度思考过程 -->
          <div v-if="msg.role === 'assistant' && parseMessage(msg.content).thinking" class="thinking-process">
            <div class="thinking-header" @click="toggleThinking(index)">
              <div class="thinking-title">
                <span class="thinking-icon" :class="{ 'spinning': !parseMessage(msg.content).content && loading }">
                  <ChatGptIcon :size="12" color="#64748b" />
                </span>
                <span class="thinking-text">{{ !parseMessage(msg.content).content && loading ? '正在思考...' : '思考过程'
                }}</span>
              </div>
              <span class="thinking-arrow" :class="{ expanded: expandedThinking[index] }">▼</span>
            </div>
            <div v-show="expandedThinking[index]" class="thinking-content">
              {{ parseMessage(msg.content).thinking }}
            </div>
          </div>

          <!-- 正文内容 -->
          <div v-if="parseMessage(msg.content).content" class="markdown-body"
            v-html="renderMarkdown(parseMessage(msg.content).content)"></div>

          <!-- 加载状态 -->
          <div v-else-if="msg.role === 'assistant' && loading" class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="input-container">
      <input v-model="inputText" type="text" placeholder="输入您的问题..." @keyup.enter="sendMessage(inputText)"
        :disabled="loading" />

      <button v-if="loading" class="stop-btn" @click="stopGeneration" title="停止生成">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      </button>
      <button v-else class="send-btn" @click="sendMessage(inputText)" :disabled="loading || !inputText.trim()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, watch } from 'vue';
import { analyzeDataStream } from '@/utils/aiService.js';
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

const props = defineProps({
  year: { type: Number, default: 2023 },
  landData: { type: Object, default: () => ({}) },
  region: { type: String, default: '云南省' }
});

const messages = ref([]);
const inputText = ref('');
const loading = ref(false);
const abortController = ref(null);
const messagesContainer = ref(null);
const suggestions = ref([
  '分析当前土地利用结构',
  '耕地变化趋势分析',
  '建设用地扩张特点'
]);

// 获取 token
const getToken = () => localStorage.getItem('auth_token');

// 停止生成
const stopGeneration = () => {
  if (abortController.value) {
    abortController.value.abort();
    abortController.value = null;
    loading.value = false;
  }
};

// 发送消息
const sendMessage = async (text) => {
  if (!text || !text.trim() || loading.value) return;

  const userMessage = text.trim();
  inputText.value = '';

  messages.value.push({
    role: 'user',
    content: userMessage
  });

  await scrollToBottom();
  loading.value = true;
  abortController.value = new AbortController();

  const assistantMsgIndex = messages.value.length;
  messages.value.push({
    role: 'assistant',
    content: ''
  });

  try {
    await analyzeDataStream(
      {
        messages: messages.value.slice(0, -1),
        year: props.year,
        landData: props.landData,
        region: props.region,
        deepThinking: true
      },
      (chunk) => {
        messages.value[assistantMsgIndex].content += chunk;
        scrollToBottom();
      },
      () => {
        loading.value = false;
        abortController.value = null;
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

const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const expandedThinking = ref({});

const toggleThinking = (index) => {
  expandedThinking.value[index] = !expandedThinking.value[index];
};

const parseMessage = (content) => {
  if (!content) return { thinking: '', content: '' };
  const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
  const thinking = thinkMatch ? thinkMatch[1].trim() : '';
  let cleanContent = content.replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*/g, '')
    .trim();
  return { thinking, content: cleanContent };
};

const renderMarkdown = (text) => {
  if (!text) return '';
  return md.render(text);
};

watch(messages, (newMsgs) => {
  if (newMsgs.length > 0) {
    const lastIndex = newMsgs.length - 1;
    const lastMsg = newMsgs[lastIndex];
    if (lastMsg.role === 'assistant' && parseMessage(lastMsg.content).thinking && expandedThinking.value[lastIndex] === undefined) {
      expandedThinking.value[lastIndex] = true;
    }
  }
}, { deep: true });

onMounted(async () => {
  try {
    const res = await fetch('/api/ai/suggestions', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.suggestions) {
      suggestions.value = data.suggestions.slice(0, 3);
    }
  } catch (e) {
    console.warn('[AI] 获取建议失败');
  }
});
</script>

<style scoped>
.ai-panel-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  overflow: hidden;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.3) transparent;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
  text-align: center;
}

.ai-avatar-icon {
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
}

.empty-logo {
  width: 64px;
  height: 64px;
  object-fit: contain;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.empty-state p {
  margin: 4px 0;
  font-size: 14px;
  font-weight: 500;
}

.sub-text {
  font-size: 12px !important;
  color: #64748b;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 20px;
  width: 100%;
}

.quick-btn {
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
}

.quick-btn:hover {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.4);
  transform: translateX(4px);
}

.message {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.message.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.9);
  color: #94a3b8;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.message.user .avatar {
  background: #3b82f6;
  color: white;
}

.content {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.6;
}

.message.user .content {
  background: #3b82f6;
  color: white;
  border-bottom-right-radius: 4px;
}

.message.assistant .content {
  background: rgba(30, 41, 59, 0.7);
  color: #e2e8f0;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-bottom-left-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Thinking Process */
.thinking-process {
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.05);
  overflow: hidden;
}

.thinking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  cursor: pointer;
  user-select: none;
}

.thinking-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #64748b;
}

.thinking-text {
  font-weight: 600;
}

.thinking-arrow {
  font-size: 9px;
  color: #475569;
  transition: transform 0.3s;
}

.thinking-arrow.expanded {
  transform: rotate(180deg);
}

.thinking-icon.spinning {
  animation: thinking-bounce 1s infinite ease-in-out;
}

@keyframes thinking-bounce {

  0%,
  100% {
    transform: translateY(0) scale(1);
    opacity: 0.7;
  }

  50% {
    transform: translateY(-1px) scale(1.1);
    opacity: 1;
  }
}

.thinking-content {
  padding: 8px 10px;
  font-size: 12px;
  color: #94a3b8;
  border-top: 1px solid rgba(255, 255, 255, 0.03);
  white-space: pre-wrap;
  font-family: 'Fira Code', monospace;
  background: rgba(0, 0, 0, 0.1);
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 6px 0;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  background: #3b82f6;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {

  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }

  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.input-container {
  display: flex;
  gap: 10px;
  padding: 16px;
  background: rgba(15, 23, 42, 0.8);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.input-container input {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 10px 14px;
  color: #f1f5f9;
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
}

.input-container input:focus {
  border-color: #3b82f6;
  background: rgba(255, 255, 255, 0.08);
}

.send-btn,
.stop-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 10px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.send-btn {
  background: #3b82f6;
}

.stop-btn {
  background: #ef4444;
}

.send-btn:hover:not(:disabled) {
  background: #2563eb;
  transform: scale(1.05);
}

.stop-btn:hover {
  background: #dc2626;
  transform: scale(1.05);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Markdown Styles */
.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 12px;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  text-align: left;
}

.markdown-body :deep(th) {
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
}
</style>
