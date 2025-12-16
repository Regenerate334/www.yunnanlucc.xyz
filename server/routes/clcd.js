import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== 加载 JSON 数据 ====================
const dataDir = path.join(__dirname, '../data');
let seriesData = [];
let summaryData = {};

try {
  const seriesPath = path.join(dataDir, 'land_use_series.json');
  const summaryPath = path.join(dataDir, 'land_use_summary.json');

  seriesData = JSON.parse(fs.readFileSync(seriesPath, 'utf-8'));
  summaryData = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));

  console.log(`[CLCD] 已加载数据: ${seriesData.length} 条时间序列记录`);
  console.log(`[CLCD] 年份范围: ${Object.keys(summaryData).sort()[0]} - ${Object.keys(summaryData).sort().pop()}`);
} catch (err) {
  console.error('[CLCD] 加载数据文件失败:', err.message);
  console.error('[CLCD] 请先运行: node server/scripts/export-data.js');
}

// ==================== 获取年份列表 ====================
/**
 * GET /api/clcd/years
 * 获取所有可用的年份列表
 */
router.get('/years', (req, res) => {
  try {
    const years = Object.keys(summaryData).map(Number).sort((a, b) => a - b);
    res.json(years);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 获取指定年份的摘要数据 ====================
/**
 * GET /api/clcd/:year/summary
 * 获取指定年份的土地利用类型面积统计
 */
router.get('/:year/summary', (req, res) => {
  try {
    const year = Number(req.params.year);

    if (!Number.isInteger(year) || year < 1980 || year > 2030) {
      return res.status(400).json({
        error: 'Invalid year parameter',
        received: req.params.year
      });
    }

    const yearData = summaryData[year];
    if (!yearData) {
      return res.status(404).json({
        error: `No data found for year ${year}`,
        availableYears: Object.keys(summaryData).map(Number).sort((a, b) => a - b)
      });
    }

    console.log(`[CLCD] 返回 ${year} 年数据: ${yearData.length} 个地类`);
    res.json(yearData);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 获取时间序列数据 ====================
/**
 * GET /api/clcd/series
 * 获取年度总面积堆叠序列
 */
router.get('/series', (req, res) => {
  try {
    const start = Number(req.query.start || 1985);
    const end = Number(req.query.end || 2023);

    const filtered = seriesData.filter(item =>
      item.year >= start && item.year <= end
    );

    console.log(`[CLCD] 返回时间序列数据: ${start}-${end}, ${filtered.length} 条记录`);
    res.json(filtered);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 测试端点 ====================
/**
 * GET /api/clcd/test
 * 测试端点
 */
router.get('/test', (req, res) => {
  try {
    res.json({
      success: true,
      message: 'API working with JSON data',
      stats: {
        totalRecords: seriesData.length,
        years: Object.keys(summaryData).length,
        yearRange: `${Object.keys(summaryData).sort()[0]} - ${Object.keys(summaryData).sort().pop()}`
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
