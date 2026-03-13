import express from 'express';
import { buildReport } from '../../utils/reportBuilder.js';
import { getReportTemplate } from '../../utils/reportTemplate.js';
import logger from '../../config/logger.js';
import puppeteer from 'puppeteer';

const router = express.Router();

/**
 * @route   POST /api/analysis/report/generate
 * @desc    生成结构化 AI 分析报告 JSON
 * @access  Private
 */
router.post('/generate', async (req, res) => {
    try {
        const { question, year, reportTitle, componentContext, model } = req.body;

        if (!question) {
            return res.status(400).json({ error: '请提供分析问题 (question)' });
        }

        const reportData = await buildReport({
            question,
            year: year || 2023,
            reportTitle,
            componentContext,
            model
        });

        res.json(reportData);
    } catch (err) {
        logger.error(`[api/report] 生成失败: ${err.message}`);
        res.status(500).json({ error: '报告生成失败', details: err.message });
    }
});

/**
 * @route   POST /api/analysis/report/preview
 * @desc    生成报告的 HTML 预览内容
 * @access  Private
 */
router.post('/preview', async (req, res) => {
    try {
        const { question, year, reportTitle, componentContext, model } = req.body;

        const reportData = await buildReport({
            question,
            year: year || 2023,
            reportTitle,
            componentContext,
            model
        });

        const html = getReportTemplate(reportData);
        res.set('Content-Type', 'text/html');
        res.send(html);
    } catch (err) {
        logger.error(`[api/report] 预览失败: ${err.message}`);
        res.status(500).send(`<h3>报告生成失败</h3><p>${err.message}</p>`);
    }
});

/**
 * @route   POST /api/analysis/report/export-pdf
 * @desc    生成并导出 PDF 文件
 * @access  Private
 */
router.post('/export-pdf', async (req, res) => {
    let browser;
    try {
        const { question, year, reportTitle, componentContext, model } = req.body;

        // 1. 生成数据与 HTML
        const reportData = await buildReport({
            question,
            year: year || 2023,
            reportTitle,
            componentContext,
            model
        });
        const html = getReportTemplate(reportData);

        // 2. 启动 Puppeteer 渲染
        console.log('[api/report] 启动 Puppeteer 生成 PDF...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // 设置视口大小
        await page.setViewport({ width: 1200, height: 1600 });

        // 注入 HTML
        await page.setContent(html, { waitUntil: 'networkidle0' });

        // 3. 导出 PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            }
        });

        // 4. 返回文件流
        const filename = `report_${Date.now()}.pdf`;
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);

    } catch (err) {
        logger.error(`[api/report] PDF 导出失败: ${err.message}`);
        res.status(500).json({ error: 'PDF 导出失败', details: err.message });
    } finally {
        if (browser) await browser.close();
    }
});

export default router;
