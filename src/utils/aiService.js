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

                    if (data.content || data.thinking || data.workflow || data.trace) {
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
                if (data.content || data.thinking || data.workflow || data.trace) onChunk?.(data);
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
    return generateQuickQuestionRows(type, params).flat();
}

/**
 * 按分析深度生成三行预设问题：直接查询、过程分析、综合研判。
 */
export function generateQuickQuestionRows(type, params = {}) {
    const { region = '云南省', year = 2023, landType = '耕地' } = params;
    const targetRegion = String(region || '云南省').trim();
    const targetYear = Number.isFinite(Number(year)) ? Number(year) : 2023;
    const targetLandType = String(landType || '耕地').trim();

    const contextualPrompts = {
        pie: [
            ANALYSIS_TEMPLATES.pieStructure(targetRegion, targetYear),
            `比较${targetRegion}主要地类的结构变化与生态用地演变`,
            `综合评价${targetRegion}土地利用结构的合理性及其优化方向`
        ],
        trend: [
            `查询${targetRegion}${targetYear}年${targetLandType}面积及占比`,
            ANALYSIS_TEMPLATES.trendOverview(targetRegion),
            `综合解释${targetRegion}${targetLandType}演变的阶段、转移路径与主要机制`
        ],
        regional: [
            `查询云南省各地级市${targetYear}年土地利用结构`,
            ANALYSIS_TEMPLATES.regionalCompare(targetYear),
            `综合研判云南省区域土地利用分异、生态风险与差异化治理重点`
        ]
    }[type] || [
        `查询${targetRegion}${targetYear}年土地利用结构`,
        `分析${targetRegion}长时序土地利用演变与主要转移路径`,
        `综合研判${targetRegion}土地利用变化、生态风险与国土空间治理方向`
    ];

    return [
        [
            contextualPrompts[0],
            `${targetRegion}${targetYear}年面积最大的地类是什么`,
            `查询${targetRegion}${targetYear}年耕地、林地和建设用地面积`,
            `列出${targetRegion}${targetYear}年各类土地面积及占比`,
            `查询${targetRegion}${targetYear}年生态用地占比`,
            `查询${targetRegion}${targetYear}年生境质量与生态韧性指标`,
            `查看${targetRegion}${targetYear}年综合监测预警状态`,
            `查询云南省各地级市${targetYear}年建设用地面积排名`,
            `检索“三区三线”相关政策文件及正文`
        ],
        [
            contextualPrompts[1],
            `对比${targetRegion}2000年与${targetYear}年土地利用结构变化`,
            `分析${targetRegion}1985—${targetYear}年建设用地增长阶段`,
            `计算${targetRegion}2000—2020年土地利用转移矩阵`,
            `分析${targetRegion}耕地减少的主要转出方向`,
            `识别${targetRegion}建设用地扩张的主要土地来源`,
            `分析${targetRegion}土地利用变化的县域集中格局`,
            `对比昆明市与曲靖市耕地变化趋势及阶段差异`,
            `分析${targetRegion}土地利用重心迁移与标准差椭圆特征`
        ],
        [
            contextualPrompts[2],
            `结合趋势、转移矩阵和空间分异解释${targetRegion}建设用地扩张机制`,
            `综合分析${targetRegion}耕地变化、主要流向及耕地保护压力`,
            `结合熵权结果研判${targetRegion}生态风险的主要贡献指标`,
            `结合土地变化证据与政策正文研判“三区三线”的治理响应`,
            `比较滇中城市群土地扩张路径、空间集聚与生态风险差异`,
            `分析${targetRegion}生态用地演变、土地转移过程及政策作用机制`,
            `形成${targetRegion}土地利用监测、预警与空间治理综合报告`,
            `基于长时序证据提出${targetRegion}分区分类的国土空间优化建议`
        ]
    ];
}
