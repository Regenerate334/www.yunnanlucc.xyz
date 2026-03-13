/**
 * 简约工业风 HTML 报表模板 (中文汉化增强版)
 */
export function getTemplate(data) {
    // 矩阵行渲染 (自动处理多列数据)
    const matrixHtml = data.matrixRows.map(row => `
        <tr>
            <td class="font-medium">${row.from}</td>
            <td>${row.to_cropland}</td>
            <td>${row.to_forest}</td>
            <td>${row.to_grass}</td>
            <td>${row.to_water || '0'}</td>
            <td class="font-bold">${row.total}</td>
        </tr>
    `).join('');

    // 地类详细分析渲染
    const landTypeHtml = data.landTypeAnalysis.map(item => `
        <div class="land-type-card">
            <div class="type-header">
                <span class="type-name">${item.type}</span>
                <span class="type-index">${item.index}</span>
            </div>
            <div class="type-desc"><strong>现状描述：</strong>${item.status}</div>
            <div class="type-trend"><strong>演变趋势：</strong>${item.trend}</div>
        </div>
    `).join('');

    // 空间分布特征渲染
    const spatialHtml = data.spatialDynamics.map(item => `
        <div class="spatial-item">
            <strong>${item.region}：</strong><span>${item.pattern}</span>
        </div>
    `).join('');

    // 核心洞察渲染
    const insightsHtml = data.insights.map(ins => `
        <div class="insight-item">
            <div class="insight-title">${ins.title}</div>
            <div class="insight-body">${ins.content}</div>
        </div>
    `).join('');

    // 对策建议渲染
    // 支持 **加粗** 语法
    const recommendationsHtml = data.recommendations.map(re => `
        <li>${re.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>${data.title}</title>
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
            body { padding: 0; background: white; color: black !important; }
            .report-container { border: none !important; box-shadow: none !important; width: 100% !important; max-width: none !important; padding: 0 !important; }
            header { border-bottom: 3px solid black !important; }
            section h2 { border-bottom: 2px solid #333 !important; }
            .land-type-card, .insight-item { border: 1px solid #ddd !important; break-inside: avoid; }
            footer { border-top: 1px solid #ccc !important; }
        }

        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
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
        }

        header {
            border-bottom: 3px solid var(--primary);
            padding-bottom: 30px;
            margin-bottom: 32px;
            text-align: center;
        }

        h1 { margin: 0; font-size: 28px; font-weight: 800; color: var(--primary); letter-spacing: -0.5px; }
        .subtitle { margin-top: 12px; font-size: 16px; color: var(--text-muted); font-weight: 500; }

        .meta-info {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: var(--text-muted);
            margin-bottom: 56px;
            font-family: "JetBrains Mono", monospace;
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
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 48px;
        }

        .stat-card {
            padding: 16px;
            border: 1px solid var(--border);
            text-align: center;
        }

        .stat-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; display: block; font-weight: 600; }
        .stat-value { font-size: 18px; font-weight: 800; color: var(--primary); font-family: "JetBrains Mono", monospace; }

        /* 地类详细展示 */
        .land-analysis-grid {
            display: grid;
            gap: 16px;
        }
        .land-type-card {
            padding: 20px;
            border: 1px solid var(--border);
            background: var(--bg);
        }
        .type-header {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid var(--border);
            padding-bottom: 8px;
            margin-bottom: 12px;
        }
        .type-name { font-weight: 800; font-size: 16px; color: var(--accent); }
        .type-index { font-family: monospace; font-size: 12px; color: var(--text-muted); }
        .type-desc, .type-trend { font-size: 13px; margin-bottom: 6px; }

        /* 转移矩阵表格 */
        .table-wrap { width: 100%; overflow-x: auto; margin: 20px 0; border: 1px solid var(--border); }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            background: var(--bg);
        }
        th {
            background: var(--secondary-bg);
            border: 1px solid var(--border);
            padding: 12px;
            text-align: left;
            font-weight: 700;
        }
        td { border: 1px solid var(--border); padding: 12px; text-align: right; }
        td:first-child { text-align: left; font-weight: 600; background: var(--secondary-bg); }

        /* 空间格局 */
        .spatial-dynamics {
            background: var(--accent-bg);
            padding: 24px;
            border-radius: 4px;
        }
        .spatial-item { font-size: 14px; margin-bottom: 12px; line-height: 1.7; }
        .spatial-item:last-child { margin-bottom: 0; }

        /* 洞察与建议 */
        .insights-list { display: grid; gap: 24px; }
        .insight-item { padding: 24px; border: 1px solid var(--border); border-left: 6px solid var(--primary); }
        .insight-title { font-size: 16px; font-weight: 800; margin-bottom: 12px; }
        .insight-body { font-size: 14px; color: var(--text-muted); line-height: 1.8; text-align: justify; }

        ul.recs { padding-left: 20px; font-size: 14px; line-height: 1.9; }
        ul.recs li { margin-bottom: 16px; padding-left: 8px; }

        footer {
            margin-top: 80px;
            padding-top: 24px;
            border-top: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: var(--text-muted);
            font-family: "JetBrains Mono", monospace;
        }
    </style>
</head>
<body>
    <div class="report-container">
        <header>
            <h1>${data.title}</h1>
            <div class="subtitle">${data.subtitle}</div>
        </header>

        <div class="meta-info">
            <span>VERSION: ${data.version}</span>
            <span>DATE: ${data.date} | AUTHOR: ${data.author}</span>
        </div>

        <section>
            <h2>研究摘要</h2>
            <div class="summary-box">${data.summary}</div>
        </section>

        <section>
            <h2>研究背景与方法论</h2>
            <div class="intro-grid">
                <div class="intro-main">
                    ${data.introduction.background}
                    <br><br>
                    <strong>技术细节：</strong>${data.introduction.methodology}
                </div>
                <div class="intro-sidebar">
                    <strong>数据质量自评：</strong><br>
                    ${data.introduction.dataQuality}
                </div>
            </div>
        </section>

        <section>
            <h2>全量核心指标</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <span class="stat-label">覆盖总面积</span>
                    <span class="stat-value">${data.stats.totalArea}</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">流转优势方向</span>
                    <span class="stat-value">${data.stats.majorChange.split(' ')[0]}</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">年均转换强度</span>
                    <span class="stat-value">${data.stats.changeRate.split(' ')[0]}</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">流转活跃单元数</span>
                    <span class="stat-value">${data.stats.activeCounties}</span>
                </div>
            </div>
        </section>

        <section>
            <h2>细分地类演变详情</h2>
            <div class="land-analysis-grid">
                ${landTypeHtml}
            </div>
        </section>

        <section>
            <h2>土地利用流转矩阵详细 (km²)</h2>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>起始地类 \ 目标地类</th>
                            <th>耕地</th>
                            <th>林地</th>
                            <th>草地</th>
                            <th>水域</th>
                            <th>总计</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${matrixHtml}
                    </tbody>
                </table>
            </div>
            <p style="font-size: 11px; color: var(--text-muted);">* 矩阵对角线处表示未发生流转的稳定地类面积。</p>
        </section>

        <section>
            <h2>空间格局演变特征</h2>
            <div class="spatial-dynamics">
                ${spatialHtml}
            </div>
        </section>

        <section>
            <h2>多维度核心洞察</h2>
            <div class="insights-list">
                ${insightsHtml}
            </div>
        </section>

        <section>
            <h2>差异化对策建议</h2>
            <ul class="recs">
                ${recommendationsHtml}
            </ul>
        </section>

        <footer>
            <span>UNCLASSIFIED / PROPRIETARY SYSTEM DATA</span>
            <span>&copy; ${new Date().getFullYear()} 云南土地利用分析系统 · 版权所有</span>
        </footer>
    </div>
</body>
</html>
    `;
}
