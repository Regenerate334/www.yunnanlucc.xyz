/**
 * routes/ai/report.js — AI 报告生成端点
 *
 * 提供两个端点：
 *  POST /api/ai/report/generate  → 生成结构化报告 JSON
 *  POST /api/ai/report/html      → 生成报告 JSON 并渲染为 HTML 字符串（供前端 iframe/print）
 */

import express from 'express';
import { buildReport } from '../../utils/reportBuilder.js';
import { getReportTemplate } from '../../utils/reportTemplate.js';

const router = express.Router();

/**
 * POST /api/ai/report/generate
 * 生成结构化报告数据（JSON）
 *
 * Body:
 *  - question         {string}  必填，分析问题
 *  - year             {number}  可选，目标年份，默认 2023
 *  - reportTitle      {string}  可选，报告标题前缀
 *  - componentContext {object}  可选，前端面板上下文
 *  - model            {string}  可选，指定 Ollama 模型名
 */
router.post('/generate', async (req, res) => {
    const { question, year, reportTitle, componentContext, model } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: '请提供有效的分析问题（question 字段）'
        });
    }

    try {
        console.log(`[route/report] 收到报告生成请求: "${question.slice(0, 50)}"`);
        const startTime = Date.now();

        const reportData = await buildReport({
            question: question.trim(),
            year: Number(year) || 2023,
            reportTitle,
            componentContext,
            model
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[route/report] 报告生成完成，耗时 ${elapsed}s`);

        return res.json({
            success: true,
            elapsed: `${elapsed}s`,
            reportData
        });

    } catch (err) {
        console.error('[route/report] 报告生成失败:', err.message);
        return res.status(500).json({
            success: false,
            error: `报告生成失败: ${err.message}`
        });
    }
});


/**
 * POST /api/ai/report/html
 * 生成报告并直接返回 HTML 字符串（供前端 iframe 或新窗口展示）
 *
 * Body: 同 /generate
 */
router.post('/html', async (req, res) => {
    const { question, year, reportTitle, componentContext, model } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: '请提供有效的分析问题（question 字段）'
        });
    }

    try {
        console.log(`[route/report/html] 收到 HTML 报告请求: "${question.slice(0, 50)}"`);

        const reportData = await buildReport({
            question: question.trim(),
            year: Number(year) || 2023,
            reportTitle,
            componentContext,
            model
        });

        const html = getReportTemplate(reportData);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);

    } catch (err) {
        console.error('[route/report/html] 失败:', err.message);
        return res.status(500).json({
            success: false,
            error: `HTML 报告生成失败: ${err.message}`
        });
    }
});

export default router;
