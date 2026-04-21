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
      <div v-if="visible" class="ai-modal-container" @click.stop>
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

          <div class="main-content">
            <div class="ai-modal-header">
              <button class="close-btn" @click="handleClose" title="关闭">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="ai-modal-body" :class="{ 'no-scroll': messages.length === 0 }" ref="messagesContainer">
              <div v-if="messages.length === 0" class="welcome-container">
                <div class="welcome-section">
                  <svg :width="160" :height="160" viewBox="0 0 1089 1024" xmlns="http://www.w3.org/2000/svg" class="welcome-logo">
                      <path
                          d="M474.62020741 115.87128889c50.36562963 0.72817778 97.57582222 20.14625185 136.29060741 58.86103703 5.70405925 5.70405925 10.67994075 7.03905185 18.3258074 5.94678519 111.04711111-15.65582222 208.50157037 54.49197037 228.89054815 164.81090371 5.33997037 29.00574815 3.64088889 57.89013333-4.61179259 86.1677037-2.06317037 6.91768889-0.72817778 11.28675555 3.76225185 16.74808889 91.87176297 112.74619259 36.89434075 283.26115555-103.52260741 320.39822222-8.00995555 2.06317037-11.52948148 5.70405925-14.32082963 12.98583704-52.18607408 135.68379259-227.43419259 172.21404445-329.62180741 68.69143703-5.09724445-5.09724445-9.46631111-6.18951111-16.384-5.2186074-112.62482963 15.89854815-210.20065185-54.37060741-230.3469037-165.90317038-5.21860741-28.64165925-3.2768-57.16195555 4.97588149-85.07543703 2.06317037-6.91768889 0.72817778-11.28675555-3.64088889-16.74808889-92.23585185-112.86755555-36.28752592-284.59614815 104.61487407-320.76231111 7.03905185-1.82044445 10.31585185-4.85451852 12.86447407-11.40811852 30.34074075-79.37137778 104.00805925-129.85837037 192.72438519-129.49428148z m122.09114074 488.72865186c-63.71555555 36.77297778-125.36794075 72.0896-186.53487407 108.01303703-13.83537778 8.13131852-25.60758518 7.88859259-39.44296297-0.24272593-47.93837037-28.39893333-96.24082963-55.94832592-144.54328889-83.61908148-3.51952592-1.94180741-6.43223703-5.94678518-12.01493333-4.2477037-6.5536 58.9824 11.89357037 108.1344 60.31739259 142.96557036 48.78791111 35.0738963 102.43034075 39.44296297 155.58731852 11.28675556 54.37060741-28.76302222 106.92077037-61.04557037 160.19911111-91.87176296 3.03407408-1.69908148 6.43223703-3.03407408 6.43223704-7.52450371v-74.75958517z m-33.98162963-401.59004445c-1.21362963-4.2477037-4.36906667-5.46133333-6.79632593-7.16041482-48.54518518-32.88936297-100.24580741-38.10797037-152.67460741-12.25765926-52.91425185 26.2144-81.07045925 70.99733333-82.64817777 130.1010963-1.57771852 60.07466667-0.24272592 120.14933333-0.60681482 180.224 0 6.43223703 2.18453333 9.8304 7.64586666 12.74311111 17.84035555 9.8304 35.43798518 20.26761482 53.03561483 30.34074074 2.18453333 1.21362963 4.12634075 3.88361482 7.76722962 1.57771852 0-71.1186963 0.24272592-142.60148148-0.12136295-214.08426667-0.12136297-14.68491852 5.46133333-24.15122963 18.20444443-31.31164444 36.89434075-20.75306667 73.42459259-42.11294815 110.07620741-63.35146667 15.4130963-8.8594963 30.82619259-17.96171852 46.11792593-26.82121481z m70.26915556 281.44071111v15.53445926c0 67.47780741-0.12136297 135.07697778 0.12136295 202.55478518 0.12136297 13.71401482-4.97588148 23.05896297-16.99081481 29.61256297-16.86945185 9.22358518-33.37481482 19.05398518-50.00154074 28.64165926-35.80207408 20.75306667-71.72551111 41.50613333-110.92574815 64.2010074 3.39816297 1.21362963 5.09724445 1.45635555 6.31087408 2.42725927 45.02565925 32.88936297 94.17765925 40.41386667 145.75691851 19.78216295 51.57925925-20.6317037 84.83271111-59.83194075 91.14358519-115.05208888 7.64586667-67.47780741 1.57771852-135.68379259 2.79134814-203.5256889 0.12136297-3.64088889-1.57771852-5.70405925-4.49042962-7.40314074-20.6317037-11.89357037-41.14204445-23.78714075-63.71555555-36.77297777zM547.19525925 392.70020741c4.97588148 3.03407408 8.37404445 4.97588148 11.65084445 6.91768889 58.73967408 33.98162963 117.35798518 68.08462222 176.34038519 101.70216295 12.74311111 7.28177778 18.20444445 16.86945185 18.08308148 31.43300742-0.36408889 56.19105185-0.12136297 112.3821037-0.12136296 168.57315555 0 4.12634075 0.36408889 8.13131852 0.60681481 13.1072 3.03407408-1.09226667 4.85451852-1.69908148 6.67496296-2.42725925 52.79288889-24.51531852 84.10453333-65.65736297 89.08041482-123.42613334 5.21860741-59.83194075-18.6898963-107.89167408-70.02642963-139.56740741-51.70062222-31.91845925-105.10032592-61.04557037-157.65048889-91.62903704-4.61179259-2.66998518-8.00995555-3.03407408-12.86447407-0.24272593-19.90352592 11.65084445-40.04977778 22.9376-61.77374816 35.55934816zM268.30317037 312.96474075c-5.46133333-0.72817778-8.73813333 1.82044445-12.13629629 3.51952592-50.24426667 25.2434963-79.6141037 66.02145185-84.2258963 121.84841481-4.73315555 57.89013333 17.71899259 105.46441482 66.87099259 136.53333334 52.67152592 33.25345185 107.64894815 62.98737778 161.53410371 94.29902221 3.15543703 1.82044445 6.06814815 3.39816297 9.70903703 1.21362964 20.87442963-12.1362963 41.74885925-24.27259259 63.83691852-37.0157037-4.61179259-2.79134815-7.76722963-4.85451852-11.04402963-6.79632594-58.73967408-33.98162963-117.35798518-68.08462222-176.34038518-101.5808-13.22856297-7.5245037-18.56853333-17.3549037-18.44717037-32.40391111 0.48545185-59.58921482 0.24272592-119.29979259 0.24272592-179.61718517z m156.67958518 107.7703111c5.09724445-2.66998518 8.49540741-4.36906667 11.77220742-6.31087407 58.13285925-33.49617778 116.38708148-66.74962963 174.15585185-100.85262223 13.83537778-8.13131852 25.60758518-8.37404445 39.44296296-0.24272592 48.66654815 28.76302222 97.69718518 56.6765037 146.60645925 84.83271112 2.91271111 1.69908148 5.33997037 4.85451852 10.31585186 3.39816295 6.43223703-57.76877037-11.04402963-106.55668148-58.25422222-141.50921481-49.03063703-36.40888889-103.27988148-41.38477037-157.40776297-12.86447407-54.37060741 28.76302222-106.92077037 61.04557037-160.32047407 91.7504-3.03407408 1.69908148-6.31087408 3.15543703-6.31087408 7.64586666v74.15277037z m171.7285926 95.51265185c0-16.62672592-0.36408889-30.4621037 0.12136296-44.17611852 0.24272592-6.31087408-1.82044445-9.95176297-7.40314074-12.98583703-24.27259259-13.59265185-48.42382222-27.54939259-72.33232592-41.74885926-4.61179259-2.79134815-8.00995555-2.79134815-12.74311112-0.12136297-23.9085037 14.19946667-48.05973333 28.15620741-72.33232592 41.74885926-5.5826963 3.15543703-7.28177778 6.79632592-7.28177778 13.1072 0.36408889 27.06394075 0.48545185 54.24924445 0 81.31318519-0.12136297 7.40314075 2.54862222 11.28675555 8.85949629 14.56355555 11.52948148 5.94678518 22.45214815 12.86447408 33.73890371 19.29671111 14.32082963 8.13131852 28.64165925 22.81623703 42.84112592 22.69487408 14.80628148-0.12136297 29.4912-14.44219259 44.05475556-22.69487408 13.95674075-8.00995555 32.28254815-13.34992592 40.17114074-25.36485925 8.13131852-12.74311111 1.45635555-32.16118518 2.3058963-45.63247408z"
                          fill="#ffffff" />
                  </svg>
                  <h1 class="welcome-title">土地利用智能分析助手</h1>
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

              <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
                <div class="bubble-wrapper">
                  <div
                    v-if="msg.role === 'assistant' && (parseMessage(msg).thinking || (loading && index === messages.length - 1))"
                    class="thinking-process">
                    <div class="thinking-header">
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
                        <span v-if="loading && index === messages.length - 1">AI 正在深度思考...</span>
                        <span v-else>耗时 {{ msg.thinkTime || '几' }} 秒完成分析</span>
                      </div>
                    </div>
                    <div v-if="parseMessage(msg).thinking" class="thinking-content">
                      {{ parseMessage(msg).thinking }}
                    </div>
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
import { analyzeDataStream, generateQuickQuestions } from '@/utils/aiService.js';
import { useMapStore } from '@/stores/map.ts';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import 'katex/dist/katex.min.css';
// ChatGptIcon 已在模版中内联，无需导入

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

const _parseMessage = (msg, skipCache = false) => {
  if (!msg) return { thinking: '', content: '', statuses: [] };
  
  let thinking = msg.thinking || '';
  let content = msg.content || '';
  const cacheKey = typeof msg === 'string' ? msg : (msg.content || '') + (msg.thinking || '');

  // 流式输出期间跳过缓存，确保每次 chunk 后都能获取最新解析结果
  if (!skipCache && parseCache.has(cacheKey)) return parseCache.get(cacheKey);

  const statuses = [];
  const brainIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>`;
  const toolIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`;
  const codeIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`;
  const radarIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M2 12h20"/><circle cx="12" cy="12" r="4"/></svg>`;
  const searchIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
  const analysisIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`;

  const seenDetails = new Set();
  const pushUniqueStatus = (statusObj) => {
    const key = `${statusObj.label}_${statusObj.detail}`;
    if (!seenDetails.has(key)) {
      statuses.push(statusObj);
      seenDetails.add(key);
    }
  };

  // 1. 统一提取所有动作和思考块 (Chronological Parsing)
  const blockRegex = /(?:\[SEARCH\]|\[ANALYSIS\]|Thought:|Action Input:|Action:|Observation:)[\s\S]*?(?=(?:\n\[SEARCH\]|\n\[ANALYSIS\]|\nThought:|\nAction Input:|\nAction:|\nObservation:|\nAnswer:|$))/gi;
  const blocks = content.match(blockRegex);
  
  if (blocks) {
    blocks.forEach(block => {
      const matchTypeArray = block.match(/^(?:\[(SEARCH|ANALYSIS)\]|(Thought|Action Input|Action|Observation):)/i);
      if (!matchTypeArray) return;
      
      const rawTag = (matchTypeArray[1] || matchTypeArray[2]).toUpperCase();
      let detail = block.replace(/^(?:\[(?:SEARCH|ANALYSIS)\]|(?:Thought|Action Input|Action|Observation):)\s*/i, '').trim();

      let type = 'analysis'; 
      let label = '';
      let iconUrl = '';

      if (rawTag === 'THOUGHT') {
        type = 'analysis';
        label = `深度思考: ${detail.length > 200 ? detail.slice(0, 200) + '...' : detail}`;
        detail = '';
        iconUrl = brainIcon;
      } else if (rawTag === 'ACTION INPUT') {
        type = 'search';
        label = `参数构造: ${detail.replace(/[\n\r]+/g, ' ')}`;
        detail = '';
        iconUrl = codeIcon;
      } else if (rawTag === 'ACTION') {
        type = 'search';
        label = `调度工具: ${detail}`;
        detail = '';
        iconUrl = toolIcon;
      } else if (rawTag === 'OBSERVATION') {
        type = 'analysis';
        label = `获取数据: ${detail.length > 200 ? detail.slice(0, 200) + '...' : detail}`;
        detail = '';
        iconUrl = radarIcon;
      } else if (rawTag === 'SEARCH') {
        type = 'search';
        label = detail || (loading.value ? 'AI数据感知核心引擎动作' : '服务挂载完毕');
        detail = '';
        iconUrl = searchIcon;
      } else if (rawTag === 'ANALYSIS') {
        type = 'analysis';
        label = detail || (loading.value ? 'AI数据感知核心引擎分析' : '分析调度闭环完成');
        detail = '';
        iconUrl = analysisIcon;
      }

      if (detail || label) {
        pushUniqueStatus({ type, done: false, label, detail, icon: iconUrl });
      }
    });

    content = content.replace(blockRegex, '').trim();
  }

  // 2. 移除可能的前缀和冗余内部标签
  if (content.startsWith('Answer:')) {
    content = content.replace(/^Answer:\s*/i, '').trim();
  }
  content = content.replace(/\[\[MAP_COMMAND:.*?\]\]/g, '').trim();

  // 原生 <think> 标签保留原有拦截逻辑（针对如 DeepSeek 等有内置思考块的模型）
  const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
  if (thinkMatch) {
    thinking = (thinking ? thinking + '\n' : '') + thinkMatch[1].trim();
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*/gi, '').trim();
  }

  // 3. 步进器动效：如果进行中，仅高亮最后一条；否则全部设为完成态
  statuses.forEach((status, idx) => {
    status.done = (!loading.value) || (idx < statuses.length - 1);
  });

  const result = { thinking, content, statuses };
  if (!skipCache) {
    if (parseCache.size > 100) parseCache.clear();
    parseCache.set(cacheKey, result);
  }
  return result;
};

const getRenderedMarkdown = (text, isStreaming = false) => {
  if (!text) return '';
  const cacheKey = text;
  // 流式输出期间跳过 renderCache，确保实时渲染
  if (!isStreaming && renderCache.has(cacheKey)) return renderCache.get(cacheKey);

  let result = md.render(text);
  
  // 3. 安全清洗 (Security Pro Max)
  result = DOMPurify.sanitize(result, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
      'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 
      'div', 'span', 'code', 'pre', 'svg', 'path', 'line', 'circle', 'polyline'
    ],
    ALLOWED_ATTR: ['class', 'style', 'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'points', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'd']
  });

  // 给 table 增加包装层
  result = result.replace(/<table>/g, '<div class="table-container"><table>').replace(/<\/table>/g, '</table></div>');

  if (!isStreaming) {
    if (renderCache.size > 200) renderCache.clear();
    renderCache.set(cacheKey, result);
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
const mapStore = useMapStore();

// 会话管理状态
const sessions = ref([]);
const currentSessionId = ref(null);

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
   // console.log('[Sessions] Selecting session:', sessionId);
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
       // console.log('[Sessions] Messages loaded:', messages.value.length);
      nextTick(() => scrollToBottom(true));
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

const saveMessage = async (role, content, thinking = '', thinkTime = 0) => {
  if (!currentSessionId.value) return;
  try {
    await fetch(`/api/chat-sessions/${currentSessionId.value}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: JSON.stringify({ role, content, thinking, thinkTime })
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
const selectedModel = ref('deepseek-v3.1:671b-cloud');
const showModelDropdown = ref(false);
const availableModels = [
  { value: 'deepseek-v3.1:671b-cloud', label: 'DeepSeek-V3.1 671B', desc: '云端超大模型 · 最强推理能力' },
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
});

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside);
  // 组件卸载时取消正在进行的请求
  if (abortController.value) {
    // console.log('[AI Modal] 组件卸载，取消正在进行的请求');
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
  // console.log('[AI Modal] 关闭对话框');
  // 关闭时取消正在进行的请求
  if (abortController.value) {
    // console.log('[AI Modal] 关闭时取消正在进行的请求');
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

const stopGeneration = () => {
  if (abortController.value) {
    // console.log('[AI Modal] 用户点击停止生成');
    abortController.value.abort();
    abortController.value = null;
    loading.value = false;
  }
};

const clearMessages = () => {
  createNewSession();
};

/**
 * 处理 AI 发出的地图控制指令
 * 识别 [[MAP_COMMAND:action,params]] 格式
 */
const handleMapCommand = (content) => {
  if (!content || !content.includes('[[MAP_COMMAND:')) return;

  // 匹配所有指令标签
  const matches = content.match(/\[\[MAP_COMMAND:(.*?)\]\]/g);
  if (!matches) return;

  matches.forEach(match => {
    try {
      const raw = match.replace('[[MAP_COMMAND:', '').replace(']]', '');
      
      // 尝试按 JSON 解析 (MCP 标准格式)
      let command;
      if (raw.trim().startsWith('{')) {
        command = JSON.parse(raw);
      } else {
        // 兼容旧的逗号分隔格式 (Legacy)
        const [action, ...params] = raw.split(',');
        command = { action, params };
      }
      
      const { action, params } = command;
      console.log(`[AI Modal] 执行地图指令: ${action}`, params);

      // 核心调度器 (Command Dispatcher)
      if (action === 'set_region') {
        const regionName = params.region || params[0];
        const entity = mapStore.findEntityByName(regionName);
        if (entity) {
          mapStore.flyToRegion(entity);
        } else {
          console.warn(`[AI Modal] 未找到区域实体: ${regionName}`);
        }
      } else if (action === 'fly_to') {
        const lnglat = params.lnglat || (params[0] ? params[0].split('/').map(Number) : null);
        const zoom = params.zoom || 25000;
        if (lnglat && !isNaN(lnglat[0]) && !isNaN(lnglat[1])) {
          mapStore.viewer?.camera.flyTo({
            destination: window.Cesium.Cartesian3.fromDegrees(lnglat[0], lnglat[1], zoom)
          });
        }
      } else if (action === 'zoom_in') {
        mapStore.viewer?.camera.zoomIn(2000);
      } else if (action === 'zoom_out') {
        mapStore.viewer?.camera.zoomOut(2000);
      } else if (action === 'fly_to_yunnan') {
        mapStore.flyToYunnan();
      }
    } catch (err) {
      console.error('[AI Modal] 地图指令解析失败:', err, match);
    }
  });
};

const userInteractedThinking = ref(false); // 追踪用户是否手动调整过折叠状态

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
  userInteractedThinking.value = false; 

  try {
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
        deepThinking: isReasoningModel.value,
        model: selectedModel.value
      },
      (chunkObj) => {
        if (chunkObj.content) {
          messages.value[assistantMsgIndex].content += chunkObj.content;
          // 只有用户没动过，我们才根据全量内容实时控制展开
          const fullContent = messages.value[assistantMsgIndex].content;
          const hasThinking = fullContent.includes('<think>') || fullContent.includes('Thought:') || fullContent.includes('Action:');
          if (hasThinking && !userInteractedThinking.value) {
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

        // 处理地图指令同步
        handleMapCommand(lastMsg.content);

        // 完成后保存 AI 消息 (持久化所有逻辑字段)
        await saveMessage('assistant', lastMsg.content, lastMsg.thinking, lastMsg.thinkTime);
        
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

// 智能包装：当消息正在流式生成时（当前回答的最后一条），自动跳过缓存
const parseMessage = (msg) => {
  // 正在生成的 assistant 消息 = messages 数组最后一条 + loading 中
  const isStreaming = loading.value && msg === messages.value[messages.value.length - 1];
  return _parseMessage(msg, isStreaming);
};
const renderMarkdown = getRenderedMarkdown;

const copyMessage = (msg) => {
  const { content } = parseMessage(msg);
  navigator.clipboard.writeText(content || msg.content || '').then(() => {
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
const buildDirectReportHtml = (title, markdownContent, meta, modelLabel = '未知模型') => {
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
        <span>AI 模型：${modelLabel}</span>
        <span>生成时间：${now}</span>
      </div>
    </div>
    <div class="report-body">
      <div class="md-content">${bodyHtml}</div>
    </div>
    <div class="report-footer">
      <span>© 昆明理工大学国土资源工程学院 彭派GIS课题组</span>
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
  
  // 标题处理逻辑：优先从 AI 回答的 "Answer: ##" 标记中提取
  let title = '';
  const assistantContent = lastAssistantMsg.content || '';
  const titleMatch = assistantContent.match(/Answer:\s*##\s*(.*?)(\n|$)/i);
  
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim();
  } else {
    // 兜底逻辑：取用户问题前 40 字
    title = lastUserMsg.content.trim().slice(0, 40) + (lastUserMsg.content.trim().length > 40 ? '...' : '');
  }

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
    }, getModelLabel.value);
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
  width: 95vw;
  height: 90vh;
  max-width: 1600px;
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
}

/* 全屏模式下的响应式调整 */
.ai-modal-container.fullscreen .welcome-container {
  max-width: 900px;
}

.sidebar {
  width: 260px;
  background: rgba(15, 23, 42, 0.1);
  border-right: 1px solid rgba(255, 255, 255, 0.08); /* 加深分割线 */
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
  word-break: break-all; /* 强制长文本/URL换行，防止溢出 */
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
  bottom: -1px; /* 稍微下移防止亚像素间隙 */
  left: 0;
  right: 0;
  padding: 20px;
  padding-top: 40px;
  border-top: none;
  /* 弱化底部实色渐变，让毛玻璃更纯粹，仅保留微弱阴影托底 */
  background: linear-gradient(to top, rgba(7, 16, 36, 0.85) 0%, rgba(7, 16, 36, 0) 100%);
  z-index: 10;
  overflow: visible !important;
}

.footer-hint {
  margin-top: 12px;
  text-align: center;
  font-size: 12px;
  color: #64748b;
}

/* Markdown 中文排版深度优化 */
.markdown-body {
  font-size: 15px;
  line-height: 2; /* 宽裕的中式行距 */
  color: #e2e8f0;
  text-align: justify; /* 两端对齐，使版面整齐 */
  text-justify: inter-ideograph;
  letter-spacing: 0.5px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
}

/* 核心：段落首行缩进 2 字符 */
.markdown-body :deep(p) {
  text-indent: 2em;
  margin-bottom: 16px;
  margin-top: 0;
}

/* 标题不需要缩进，加粗且保持适当间距 */
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  text-indent: 0; 
  color: #f8fafc;
  margin-top: 24px;
  margin-bottom: 12px;
  font-weight: 600;
  text-align: left;
}

.markdown-body :deep(h1) { font-size: 22px; }
.markdown-body :deep(h2) { font-size: 18px; }
.markdown-body :deep(h3) { font-size: 16px; }

/* 列表不随段落缩进，使用自身 padding */
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  text-indent: 0;
  padding-left: 2em;
  margin-bottom: 16px;
  margin-top: 0;
}

.markdown-body :deep(li) {
  margin-bottom: 6px;
}

.markdown-body :deep(strong) {
  color: #60a5fa;
  font-weight: 600;
}

.markdown-body :deep(blockquote) {
  text-indent: 0;
  border-left: 4px solid rgba(96, 165, 250, 0.5);
  margin: 16px 0;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  color: #cbd5e1;
  border-radius: 0 4px 4px 0;
}

/* 表格排版优化：取消强制 100% 宽度，支持按内容自适应并横向滚动 */
.markdown-body :deep(.table-container) {
  width: 100%;
  text-align: center; /* 配合 inline-table 实现安全居中 */
  overflow-x: auto;
  margin: 20px 0;
  text-indent: 0; /* 表格内绝不缩进 */
  padding-bottom: 8px; /* 为滚动条留出空间 */
}

.markdown-body :deep(table) {
  display: inline-table; /* 核心修改：确保溢出时左侧内容不丢失 */
  border-collapse: separate;
  border-spacing: 0;
  width: auto; /* 改为自适应内容 */
  max-width: 100%;
  min-width: 60%; /* 保证表格不会太窄 */
  background: rgba(15, 23, 42, 0.4);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  table-layout: auto;
}

.markdown-body :deep(th) {
  padding: 12px 18px;
  background: rgba(255, 255, 255, 0.05);
  color: #93c5fd;
  font-weight: 600;
  text-align: center;
  font-size: 14px;
  line-height: 1.5;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  white-space: nowrap; /* 表头强制不换行，确保视觉整齐 */
}

.markdown-body :deep(td) {
  padding: 10px 18px;
  text-align: center;
  font-size: 13.5px;
  line-height: 1.6;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  white-space: normal; /* 允许内容换行 */
  word-break: keep-all; /* 核心：防止年份、数字等被强制截断换行 */
  overflow-wrap: break-word; /* 针对超长连续字符（如URL）强制折行 */
  min-width: 60px; /* 给短文本预留基本宽度 */
}

.markdown-body :deep(tr:last-child td) {
  border-bottom: none;
}

.markdown-body :deep(tr:hover td) {
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
</style>
