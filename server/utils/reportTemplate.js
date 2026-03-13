/**
 * reportTemplate.js — 报告 HTML 模板（服务端版本）
 *
 * 将 experiments/ai_report_demo/template.js 升级为：
 *  1. 适配 reportBuilder.js 输出的结构化 JSON（insights 含 significance 字段）
 *  2. 支持动态 insights 数量
 *  3. 去掉对 matrixRows 的硬编码依赖（stats 模块通用化）
 *
 * 供 routes/ai/report.js 的 /html 端点调用。
 */

export function getReportTemplate(data) {
    // 1. 数据预处理与子模板渲染

    // Markdown 处理增强 (支持加粗、列表、换行)
    const mdToHtml = (str) => {
        if (!str) return '';
        let html = escHtml(str)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/^\s*[-*]\s+(.*)/gm, '<li>$1</li>')
            .replace(/\n/g, '<br>');

        // 如果包含 <li>，包裹在 <ul> 中
        if (html.includes('<li>')) {
            html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        }
        return html;
    };

    // 动态探测矩阵列名 (不再硬编码)
    const allToCols = new Set();
    (data.matrixRows || []).forEach(row => {
        Object.keys(row).forEach(k => {
            if (k.startsWith('to_') && k !== 'total') allToCols.add(k);
        });
    });
    const sortedCols = Array.from(allToCols).sort();

    // 矩阵表头翻译映射
    const colLabels = {
        'to_cropland': '耕地',
        'to_forest': '林地',
        'to_grass': '草地',
        'to_water': '水域',
        'to_shrub': '灌木',
        'to_barren': '裸地',
        'to_built': '建设用地',
        'to_wetland': '湿地',
        'to_ice': '冰雪'
    };

    // 矩阵行渲染
    const matrixHtml = (data.matrixRows || []).map(row => `
        <tr>
            <td class="font-medium">${escHtml(row.from)}</td>
            ${sortedCols.map(c => `<td>${escHtml(row[c] || '0')}</td>`).join('')}
            <td class="font-bold">${escHtml(row.total || '0')}</td>
        </tr>
    `).join('');

    const matrixHeaderHtml = `
        <th>起始 \\ 目标</th>
        ${sortedCols.map(c => `<th>${escHtml(colLabels[c] || c.replace('to_', ''))}</th>`).join('')}
        <th>总计</th>
    `;

    // 地类详细分析渲染
    const landTypeHtml = (data.landTypeAnalysis || []).map(item => `
        <div class="land-type-card">
            <div class="type-header">
                <span class="type-name">${escHtml(item.type)}</span>
                <span class="type-index">${mdToHtml(item.index || '')}</span>
            </div>
            <div class="type-desc"><strong>现状描述：</strong>${mdToHtml(item.status)}</div>
            <div class="type-trend"><strong>演变趋势：</strong>${mdToHtml(item.trend)}</div>
        </div>
    `).join('');

    // 空间分布特征渲染
    const spatialHtml = (data.spatialDynamics || []).map(item => `
        <div class="spatial-item">
            <strong>${escHtml(item.region)}：</strong><span>${mdToHtml(item.pattern)}</span>
        </div>
    `).join('');

    // 核心洞察渲染
    const insightsHtml = (data.insights || []).map(ins => `
        <div class="insight-item">
            <div class="insight-title">${escHtml(ins.title)}</div>
            <div class="insight-body">${mdToHtml(ins.content)}</div>
            ${ins.significance ? `<div class="insight-sig">📌 ${mdToHtml(ins.significance)}</div>` : ''}
        </div>
    `).join('');

    // 对策建议渲染
    const recommendationsHtml = (data.recommendations || []).map(re => `
        <li>${mdToHtml(re)}</li>
    `).join('');

    const summaryHtml = mdToHtml(data.summary || '');
    const backgroundHtml = mdToHtml(data.background || '本分析基于武汉大学杨杰和黄昕团队开发的中国年度土地覆盖数据集 (CLCD)，该数据集涵盖了中国 1985-2023 年间的逐年土地利用动态，由 33.5 万景 Landsat 影像驱动生成。');
    const methodologyHtml = mdToHtml(data.methodology || '基于 Google Earth Engine (GEE) 平台，采用随机森林分类器、多时相特征构建以及时空滤波和逻辑推理。总体分类精度达到 79.31% (Yang and Huang, 2021)。');

    const fallbackBanner = data.isFallback
        ? `<div class="fallback-banner">⚠ AI 格式化输出异常，此报告为降级版本，建议调整问题后重新生成。</div>`
        : '';

    const refId = `RPT-${(data.generatedAt || '').replace(/[\/\-]/g, '')}-${Math.floor(Math.random() * 1000)}`;

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escHtml(data.title || '土地分析报告')}</title>
    <style>
        :root {
            --bg: #ffffff;
            --text: #1a1a1a;
            --text-muted: #666666;
            --border: #dfdfdf;
            --primary: #000000;
            --accent: #2563eb;
            --accent-bg: #f0f7ff;
            --secondary-bg: #f9f9f9;
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #111111;
                --text: #e5e5e5;
                --text-muted: #949494;
                --border: #2a2a2a;
                --primary: #ffffff;
                --accent: #3b82f6;
                --accent-bg: #1a2233;
                --secondary-bg: #1a1a1a;
            }
        }

        @media print {
            @page {
                size: A4;
                margin: 20mm;
            }
            body { 
                padding: 0 !important; 
                background: white !important; 
                color: black !important; 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact;
            }
            .report-container { 
                border: none !important; 
                box-shadow: none !important; 
                width: 100% !important; 
                max-width: none !important; 
                padding: 0 !important;
                margin: 0 !important;
            }
            header { border-bottom: 3px solid black !important; margin-bottom: 20mm !important; }
            section { break-inside: avoid; margin-bottom: 15mm !important; }
            section h2 { border-bottom: 2px solid #333 !important; }
            .land-type-card, .insight-item { border: 1px solid #ddd !important; break-inside: avoid; margin-bottom: 5mm !important; }
            .summary-box { border: 1px solid #eee !important; background: #fafafa !important; }
            footer { border-top: 1px solid #ccc !important; position: fixed; bottom: 0; width: 100%; }
            .fallback-banner { display: none; }
        }

        * { box-sizing: border-box; }
        body {
            font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
            background-color: var(--secondary-bg);
            color: var(--text);
            line-height: 1.6;
            margin: 0;
            padding: 40px 10px;
        }

        .report-container {
            max-width: 900px;
            margin: 0 auto;
            border: 1px solid var(--border);
            padding: 60px 80px;
            background: var(--bg);
            box-shadow: 0 4px 20px rgba(0,0,0,0.05);
            position: relative;
        }

        /* 模拟水印 */
        .report-container::before {
            content: "INTERNAL USE ONLY";
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 80px;
            color: rgba(0,0,0,0.02);
            pointer-events: none;
            z-index: 0;
            white-space: nowrap;
        }

        .fallback-banner {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 12px 20px;
            margin-bottom: 30px;
            font-size: 14px;
            border-radius: 4px;
        }

        header {
            border-bottom: 3.5px solid var(--primary);
            padding-bottom: 30px;
            margin-bottom: 32px;
            text-align: center;
            position: relative;
            z-index: 1;
        }

        h1 { margin: 0; font-size: 32px; font-weight: 800; color: var(--primary); letter-spacing: -0.5px; }
        .subtitle { margin-top: 12px; font-size: 16px; color: var(--text-muted); font-weight: 500; }

        .meta-info {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: var(--text-muted);
            margin-bottom: 56px;
            font-family: monospace;
            padding: 0 4px;
        }

        section { margin-bottom: 56px; }
        h2 { 
            font-size: 15px; 
            letter-spacing: 2px; 
            border-bottom: 2px solid var(--primary);
            padding-bottom: 8px;
            margin-bottom: 24px;
            color: var(--primary);
            font-weight: 800;
            display: inline-block;
            text-transform: uppercase;
        }

        .intro-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 40px;
            font-size: 14px;
            margin-bottom: 40px;
        }
        .intro-main { text-align: justify; line-height: 1.8; }
        .intro-sidebar { 
            background: var(--accent-bg); 
            padding: 20px; 
            border-left: 4px solid var(--accent);
            font-size: 13px;
        }

        .summary-box {
            font-size: 15px;
            line-height: 1.8;
            background: var(--secondary-bg);
            padding: 24px;
            border-radius: 4px;
            margin-bottom: 40px;
            border: 1px dashed var(--border);
            text-align: justify;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 20px;
            margin-bottom: 48px;
        }

        .stat-card {
            padding: 16px;
            border: 1px solid var(--border);
            text-align: center;
            background: var(--bg);
        }

        .stat-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; display: block; font-weight: 600; }
        .stat-value { font-size: 18px; font-weight: 800; color: var(--primary); font-family: monospace; }

        .land-analysis-grid { display: grid; gap: 16px; }
        .land-type-card { padding: 20px; border: 1px solid var(--border); background: var(--bg); }
        .type-header { display: flex; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 12px; }
        .type-name { font-weight: 800; font-size: 16px; color: var(--accent); }
        .type-index { font-family: monospace; font-size: 12px; color: var(--text-muted); }
        .type-desc, .type-trend { font-size: 13px; margin-bottom: 6px; }

        .table-wrap { width: 100%; overflow-x: auto; margin: 20px 0; border: 1px solid var(--border); }
        table { width: 100%; border-collapse: collapse; font-size: 12px; background: var(--bg); }
        th { background: var(--secondary-bg); border: 1px solid var(--border); padding: 12px; text-align: left; font-weight: 700; }
        td { border: 1px solid var(--border); padding: 12px; text-align: right; }
        td:first-child { text-align: left; font-weight: 600; background: var(--secondary-bg); }

        .spatial-dynamics { background: var(--accent-bg); padding: 24px; border-radius: 4px; }
        .spatial-item { font-size: 14px; margin-bottom: 12px; line-height: 1.7; }

        .insights-list { display: grid; gap: 24px; }
        .insight-item { padding: 24px; border: 1px solid var(--border); border-left: 6px solid var(--primary); }
        .insight-title { font-size: 16px; font-weight: 800; margin-bottom: 12px; }
        .insight-body { font-size: 14px; color: var(--text-muted); line-height: 1.8; text-align: justify; }
        .insight-sig { font-size: 12px; color: var(--accent); background: var(--accent-bg); padding: 8px 12px; margin-top: 12px; border-radius: 4px; }

        ul.recs { padding-left: 20px; font-size: 14px; line-height: 1.9; }
        ul.recs li { margin-bottom: 16px; }

        footer {
            margin-top: 80px;
            padding-top: 24px;
            border-top: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: var(--text-muted);
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="report-container">
        ${fallbackBanner}
        <header>
            <h1>${escHtml(data.title || '土地利用分析报告')}</h1>
            <div class="subtitle">云南省 ${escHtml(data.year || '2023')} 年度土地利用与覆盖变化（LUCC）专题建议</div>
        </header>

        <div class="meta-info">
            <span>REF: ${escHtml(refId)}</span>
            <span>DATE: ${escHtml(data.generatedAt || '')} | YEAR: ${escHtml(String(data.year || 2023))}</span>
        </div>

        <section>
            <h2>研究摘要</h2>
            <div class="summary-box">${summaryHtml}</div>
        </section>

        <section>
            <h2>研究背景与方法论</h2>
            <div class="intro-grid">
                <div class="intro-main">${backgroundHtml}</div>
                <div class="intro-sidebar">
                    <strong>技术细节：</strong><br>${methodologyHtml}
                </div>
            </div>
        </section>

        ${data.stats ? `
        <section>
            <h2>核心指标概览</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <span class="stat-label">覆盖总面积</span>
                    <span class="stat-value">${mdToHtml(data.stats.totalArea || '—')}</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">流转主导方向</span>
                    <span class="stat-value">${mdToHtml(data.stats.majorChange || '—')}</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">核心变化强度</span>
                    <span class="stat-value">${mdToHtml(data.stats.changeRate || '—')}</span>
                </div>
                ${data.stats.activeCounties ? `
                <div class="stat-card">
                    <span class="stat-label">流转活跃单位</span>
                    <span class="stat-value">${mdToHtml(data.stats.activeCounties)}</span>
                </div>` : ''}
            </div>
        </section>` : ''}

        ${landTypeHtml ? `
        <section>
            <h2>细分地类演变详情</h2>
            <div class="land-analysis-grid">${landTypeHtml}</div>
        </section>` : ''}

        ${matrixHtml ? `
        <section>
            <h2>土地利用流转矩阵 (km²)</h2>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>${matrixHeaderHtml}</tr>
                    </thead>
                    <tbody>${matrixHtml}</tbody>
                </table>
            </div>
        </section>` : ''}

        ${spatialHtml ? `
        <section>
            <h2>空间格局特征</h2>
            <div class="spatial-dynamics">${spatialHtml}</div>
        </section>` : ''}

        <section>
            <h2>深度洞察分析</h2>
            <div class="insights-list">${insightsHtml}</div>
        </section>

        <section>
            <h2>决策优化建议</h2>
            <ul class="recs">${recommendationsHtml}</ul>
        </section>

        <footer>
            <span>UNCLASSIFIED / INTERNAL USE ONLY</span>
            <span>&copy; ${new Date().getFullYear()} Yunnan Land Analysis System</span>
        </footer>
    </div>
</body>
</html>
    `;
}

/**
 * 简单 HTML 转义，防止 XSS（AI 输出内容直接插入 HTML）
 */
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
