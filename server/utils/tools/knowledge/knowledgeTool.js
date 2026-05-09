/**
 * Agent 专用执行工具 (Agent Dedicated Tool Executor)
 * 职责：作为 Agent 动作节点，提供针对 knowledgeTool 维度的真实数据获取及格式化封装。
 *
 * 修改提示：
 * 1. 返回值需最大程度扁平化和自然语言化，便于大模型理解和吸收。
 * 2. 若涉及异步操作，请务必处理 Promise 的 catch 块防止未捕获异常。
 * 3. 遵循现有的 ESLint 和团队代码规范，保持极简及高可读性。
 */
import fs from 'fs/promises';
import path from 'path';
import registry from '../../dataSourceRegistry.js';
import logger from '../../../config/logger.js';

const SKILLS_DIR = path.resolve('server/knowledge/skills');

const knowledgeTool = {
    name: 'knowledge_base_lookup',
    description: '查询系统的专家知识库（专业技能）。当你对 LULC、LUCC 评价指标、空间重心迁移演算规则等业务逻辑不确定时，请务必查询此库。',
    keywords: ['知识库', '指标定义', '业务逻辑', '算法说明', '专业词汇', '推理规则', '专家建议'],
    parameters: {
        type: 'object',
        properties: {
            skill_name: {
                type: 'string',
                enum: ['monitoring_indices', 'spatial_reasoning', 'policy_expert'],
                description: '要查询的技能模块名称'
            }
        },
        required: ['skill_name']
    },

    async query(args) {
        const { skill_name } = args;
        const filePath = path.join(SKILLS_DIR, `${skill_name}.md`);

        logger.info(`[knowledgeTool] 正在检索专家知识: ${skill_name}`);

        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return { type: 'knowledge', content, skill_name };
        } catch (err) {
            logger.error(`[knowledgeTool] 检索失败: ${err.message}`);
            return { type: 'knowledge', content: `未找到名为 ${skill_name} 的知识模块。`, skill_name };
        }
    },

    format(data) {
        return [
            `> ### 📖 [专家知识库] ${data.skill_name} 模块`,
            '',
            data.content,
            '',
            `> *提示：以上内容为核心业务准则，请严格依据上述逻辑进行后续分析。*`
        ].join('\n');
    }
};

registry.register(knowledgeTool);
export default knowledgeTool;
