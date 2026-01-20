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
        console.error('[AI Service] 请求失败:', error);
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
export async function analyzeDataStream({ messages, year, landData, region, deepThinking, model }, onChunk, onDone, onError, signal) {
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
                region,
                deepThinking,
                model
            }),
            signal // 支持取消请求
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');

            // 保留最后一行（可能不完整）
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;

                try {
                    const data = JSON.parse(line.slice(6));
                    if (data.content) {
                        onChunk(data.content);
                    }
                    if (data.done) {
                        onDone?.();
                    }
                    if (data.error) {
                        onError?.(data.error);
                    }
                } catch (e) {
                    console.error('[AI Service] 解析 SSE 行失败:', e.message, 'Line:', line);
                }
            }
        }

        // 处理剩余缓冲区
        if (buffer.startsWith('data: ')) {
            try {
                const data = JSON.parse(buffer.slice(6));
                if (data.content) onChunk(data.content);
                if (data.done) onDone?.();
            } catch (e) { }
        }

        onDone?.();
    } catch (error) {
        console.error('[AI Service] 流式请求失败:', error);
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
    ecologicalAssess: (region, year) => `评估${region}${year}年的生态环境状况`,
    policyAdvice: (region) => `针对${region}的土地利用现状，提供政策建议`
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
                ANALYSIS_TEMPLATES.pieChange(region, year),
                ANALYSIS_TEMPLATES.ecologicalAssess(region, year),
                `${region}哪种地类占比最大？`,
                `${region}的建设用地占比是多少？`,
                `分析${region}的林地保护现状`
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
                `分析各地级市土地利用动态度排名`,
                `哪些地区建设用地扩张最快？`,
                `边境地区土地利用特点`,
                `城市化率最高的地级市是哪个？`,
                `经济发展与土地利用的关系`
            ];
        default:
            return [
                '分析当前土地利用结构',
                '耕地变化趋势分析',
                '建设用地扩张特点',
                '生态环境质量评估',
                '土地利用政策建议',
                '未来发展趋势预测'
            ];
    }
}
