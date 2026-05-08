/**
 * @module utils/aiService
 * @description AI 大模型交互服务层，处理 SSE 流式通信、Markdown 解析及打字机效果。
 * @author System
 * @dependencies fetch API, MarkdownIt
 */

/**
 * AI 分析服务 - 提供可复用的 AI 分析功能
 */

const getToken = () => localStorage.getItem('auth_token');

/**
 * 发送 AI 分析请求（非流式）
 * @param {Object} params - 分析参数
 * @param {string} params.question - 分析问题
 * @param {number} params.year - 年份
 * @param {Object} params.landData - 土地利用数据
 * @param {string} params.context - 额外上下文（如地区名称）
 * @returns {Promise<{success: boolean, answer: string}>}
 */
export async function analyzeData({ question, year, landData, context }) {
    try {
        const response = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
                question: context ? `[${context}] ${question}` : question,
                year,
                landData
            })
        });

        const data = await response.json();
        return {
            success: data.success || false,
            answer: data.answer || '分析失败，请稍后重试。'
        };
    } catch (error) {
        // console.error('[AI Service] 请求失败:', error);
        return {
            success: false,
            answer: '网络错误，请检查连接后重试。'
        };
    }
}

/**
 * 流式 AI 分析请求 - 逐字输出
 * @param {Object} params - 分析参数
 * @param {Function} onChunk - 每收到一段文字时的回调 (text: string) => void
 * @param {Function} onDone - 完成时的回调 () => void
 * @param {Function} onError - 错误时的回调 (error: string) => void
 */
export async function analyzeDataStream({ messages, year, landData, componentContext, region, deepThinking, model, sessionId }, onChunk, onDone, onError, signal) {
    try {
        // 清理消息历史,只保留 role 和 content,避免 Vue 响应式对象的干扰
        const sanitizedMessages = messages.map(m => ({
            role: m.role,
            content: m.content
        }));

        const response = await fetch('/api/ai/analyze-stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
                messages: sanitizedMessages,
                year,
                landData,
                componentContext,
                region,
                deepThinking,
                model,
                sessionId
            }),
            signal // 支持取消请求
        });

        if (!response.ok) {
            let errMsg = `HTTP ${response.status}`;
            let bodyJson = null;
            try {
                bodyJson = await response.json();
                errMsg = bodyJson?.error || bodyJson?.message || errMsg;
            } catch { }
            if (response.status === 503) errMsg = 'AI 模型当前暂不可用（可能正在加载），请稍后重试。';
            else if (response.status === 401) errMsg = '登录已过期，请重新登录。';
            else if (response.status === 413) errMsg = bodyJson?.error || '当前会话上下文过长，建议新建对话后继续。';
            else if (response.status >= 500) errMsg = `服务器错误（${response.status}），请稍后重试。`;
            throw new Error(errMsg);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let doneEmitted = false;

        const emitDone = () => {
            if (!doneEmitted) {
                doneEmitted = true;
                onDone?.();
            }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 保留可能不完整的最后一行

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                    const data = JSON.parse(line.slice(6));
                    if (!data) continue;

                    if (data.content || data.thinking || data.workflow) {
                        onChunk?.(data);
                    }
                    if (data.done) {
                        emitDone();
                    }
                    if (data.error) {
                        onError?.(data.error);
                    }
                } catch (e) {
                    // console.error('[AI Service] SSE Parse Error:', e.message, line);
                }
            }
        }

        // 处理最后的 buffer
        if (buffer && buffer.startsWith('data: ')) {
            try {
                const data = JSON.parse(buffer.slice(6));
                if (data.content || data.thinking || data.workflow) onChunk?.(data);
                if (data.done) emitDone();
            } catch (e) { }
        }

        emitDone();
    } catch (error) {
        if (error.name === 'AbortError') {
            // console.log('[AI Service] 请求被用户中止');
            return;
        }
        // console.error('[AI Service] 流式请求失败:', error);
        onError?.(error.message || '网络错误');
    }
}

/**
 * 预设分析模板
 */
export const ANALYSIS_TEMPLATES = {
    // 饼图分析
    pieStructure: (region, year) => `分析${region}${year}年的土地利用结构特征，包括各地类占比和空间分布特点`,
    pieChange: (region, year) => `${region}${year}年的土地利用结构相比历史有何变化？`,

    // 趋势分析
    trendOverview: (region) => `分析${region}1985-2023年的土地利用变化总体趋势`,
    trendDetail: (region, landType) => `分析${region}的${landType}面积变化趋势及原因`,

    // 区域对比
    regionalCompare: (year) => `对比云南省各地级市${year}年的土地利用差异`,

    // 综合评价
    ecologicalAssess: (region, year) => `评估${region}${year}年的生态环境状况及土地利用合理性`,
    policyAdvice: (region) => `针对${region}的土地利用现状，提出可持续发展的政策建议`
};

/**
 * 快捷问题生成
 */
export function generateQuickQuestions(type, params = {}) {
    const { region = '云南省', year = 2023, landType = '耕地' } = params;

    switch (type) {
        case 'pie':
            return [
                ANALYSIS_TEMPLATES.pieStructure(region, year),
                `${region}哪种地类占比最大？请结合空间分布详细说明`,
                `分析${region}建设用地的占比，并评价其城市化水平`,
                `${region}${year}年是否存在某类地类面积异常波动？`,
                `计算${region}的生态用地总占比（林地+草地+水域）`,
                ANALYSIS_TEMPLATES.ecologicalAssess(region, year)
            ];
        case 'trend':
            return [
                ANALYSIS_TEMPLATES.trendOverview(region),
                ANALYSIS_TEMPLATES.trendDetail(region, landType),
                ANALYSIS_TEMPLATES.policyAdvice(region),
                `${region}哪一年建设用地增长最快？`,
                `耕地减少的主要原因是什么？`,
                `预测未来土地利用变化趋势`,
                `哪些地类变化最剧烈？`,
                `生态用地是否在扩张？`
            ];
        case 'regional':
            return [
                ANALYSIS_TEMPLATES.regionalCompare(year),
                `对比 ${region || '昆明和曲靖'} 的土地利用动态度排名`,
                `找出 ${year} 年建设用地扩张最快的前三个地区`,
                `分析云南省边境地区（如西双版纳、德宏）的土地利用特点`,
                `评价各地地级市的耕地保有量达成情况`,
                `研究区域生产总值与建设用地扩张的关联性`
            ];
        default:
            return [
                '分析当前玉溪市土地利用结构',
                '对比昆明和曲靖的耕地变化趋势',
                '分析西双版纳建设用地扩张特点',
                '评估全省生态环境质量演变情况',
                '针对滇中城市群提出土地利用政策建议',
                '预测云南省 2030 年土地利用空间格局'
            ];
    }
}
