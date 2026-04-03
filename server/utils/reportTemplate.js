/**
 * reportTemplate.js — 顶级学术报告模板 (PRO MAX)
 * 
 * 严格复刻 experiments/ai_report_demo/曲靖市土地利用演变与生态安全感知报告模板.html
 * 包含：
 * 1. 动态 SVG Sparklines
 * 2. 完整 CSS 变量与 Midnight Blue 工业设计
 * 3. 结构化专家洞察 (01, 02...)
 * 4. 差异化建议列表
 */

export function getReportTemplate(data) {
    /**
     * 构建简易 SVG 趋势图 (Sparkline) - 升级版
     */
    const createSparkline = (points, color = '#3b82f6') => {
        if (!points || !Array.isArray(points) || points.length < 2) return '';
        const width = 120;
        const height = 40;
        const min = Math.min(...points);
        const max = Math.max(...points);
        const range = max - min || 1;

        const pathData = points.map((p, i) => {
            const x = (i / (points.length - 1)) * width;
            const y = height - ((p - min) / range) * height;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');

        return `
            <svg viewBox="0 -2 ${width} ${height + 4}" class="sparkline" preserveAspectRatio="none">
                <path d="${pathData}" stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
        `;
    };

    /**
     * 安全转义与文本处理
     */
    const escHtml = (str) => {
        if (str === undefined || str === null) return '';
        const text = typeof str === 'string' ? str : JSON.stringify(str);
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };

    const mdToHtml = (str) => {
        if (!str) return '';
        if (typeof str !== 'string') return escHtml(str);
        // [Security] 先进行 HTML 转义，然后再处理 Markdown 标记，防止 XSS
        const escaped = escHtml(str);
        return escaped.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    };

    // 1. 指标 (关键过滤：无标题或无值的指标不显示)
    const keyMetricsArr = (data.keyMetrics || []).filter(m => m.label && m.value);
    const metricsHtml = keyMetricsArr.map(m => `
        <div class="glass-card stat-item">
            <div class="stat-info">
                <div class="stat-label">${escHtml(m.label)}</div>
                <div class="stat-value">${mdToHtml(m.value)}</div>
                ${m.desc ? `<div class="stat-desc">${escHtml(m.desc)}</div>` : ''}
            </div>
            <div class="stat-viz">
                ${createSparkline(m.trend, m.color || '#3b82f6')}
            </div>
        </div>
    `).join('');

    // 2. 矩阵 (只有当有有效流转数据时显示)
    const matrixRows = (data.matrixRows || []).filter(row => row.total > 0);
    const matrixHtml = matrixRows.map(row => `
        <tr>
            <td class="cell-head">${escHtml(row.from)}</td>
            <td>${escHtml(row.to_cropland || '0')}</td>
            <td>${escHtml(row.to_forest || '0')}</td>
            <td>${escHtml(row.to_grass || '0')}</td>
            <td>${escHtml(row.to_built || '0')}</td>
            <td class="cell-total">${escHtml(row.total || '0')}</td>
        </tr>
    `).join('');

    // 3. 洞察 (严格过滤无内容的洞察)
    const insights = (data.insights || []).filter(ins => ins.content && ins.content.trim() !== '');
    const insightsHtml = insights.map((ins, idx) => `
        <div class="step-card">
            <div class="step-num">${String(idx + 1).padStart(2, '0')}</div>
            <div class="step-body">
                <h3>${escHtml(ins.title || '核心分析结果')}</h3>
                <div class="step-text">${mdToHtml(ins.content)}</div>
                
                ${ins.evidence && ins.evidence.length > 0 ? `
                <div class="evidence-row">
                    ${ins.evidence.map(ev => `
                    <div class="ev-chip">
                        <span class="ev-n">${escHtml(ev.name)}:</span>
                        <span class="ev-v">${escHtml(ev.value)}</span>
                    </div>`).join('')}
                </div>` : ''}

                ${ins.significance ? `
                <div class="sig-note">
                    <strong>战略意义：</strong>${mdToHtml(ins.significance)}
                </div>` : ''}
            </div>
        </div>
    `).join('');

    // 4. 建议 (自适应列表渲染)
    const recommendations = (data.recommendations || []).filter(r => r);
    const recListHtml = recommendations.map(rec => {
        if (typeof rec === 'string') return `<div class="rec-item"><span></span><p>${mdToHtml(rec)}</p></div>`;
        const target = rec.target || rec.goal || rec.title || '';
        let actions = rec.action || rec.actions || rec.content || rec.suggestion || '';
        if (Array.isArray(actions)) actions = actions.join('；');
        if (!actions) return '';
        return `
            <div class="rec-item">
                <span></span>
                <div>
                    <b>${escHtml(target)}</b>：${mdToHtml(actions)}
                    ${rec.expectedOutcome ? `<div class="rec-sub">预期效果: ${mdToHtml(rec.expectedOutcome)}</div>` : ''}
                </div>
            </div>`;
    }).join('');

    const refId = `LUCC-${(data.generatedAt || '').replace(/\D/g, '') || Date.now()}`;

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escHtml(data.title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary-bg: #020617;
            --sidebar-bg: rgba(15, 23, 42, 0.8);
            --accent-glow: #3b82f6;
            --text-h: #f8fafc;
            --text-p: #94a3b8;
            --text-info: #38bdf8;
            --glass-border: rgba(51, 65, 85, 0.4);
            --card-radius: 12px;
        }

        * { box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: var(--primary-bg);
            color: var(--text-p);
            margin: 0; padding: 0;
            overflow-x: hidden;
            display: flex; justify-content: center;
        }

        .report-grid {
            width: 100vw;
            max-width: 1200px;
            min-height: 100vh;
            display: grid;
            grid-template-columns: 320px 1fr;
            background: linear-gradient(180deg, rgba(15, 23, 42, 0.3) 0%, transparent 100%);
        }

        /* 左侧边栏：核心指标与快照 */
        aside {
            background: var(--sidebar-bg);
            border-right: 1px solid var(--glass-border);
            padding: 40px 30px;
            backdrop-filter: blur(20px);
            position: sticky; top: 0; height: 100vh;
            display: flex; flex-direction: column;
        }

        .aside-header { margin-bottom: 40px; }
        .aside-tag { font-size: 10px; font-weight: 800; color: var(--text-info); letter-spacing: 2px; text-transform: uppercase; }
        .aside-ref { font-family: 'JetBrains Mono'; font-size: 10px; color: var(--text-dim); margin-top: 8px; opacity: 0.5; }

        .stat-sidebar-grid { display: grid; gap: 20px; }
        .stat-mini-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid var(--glass-border);
            border-radius: var(--card-radius);
            padding: 16px;
        }
        .mini-label { font-size: 11px; font-weight: 600; color: var(--text-p); margin-bottom: 4px; }
        .mini-value { font-size: 20px; font-weight: 800; color: var(--text-h); font-family: 'JetBrains Mono'; }
        .mini-viz { height: 30px; margin-top: 10px; opacity: 0.6; }

        /* 主内容区 */
        main {
            padding: 60px 80px;
            max-height: 100vh;
            overflow-y: auto;
            scrollbar-width: thin;
        }

        header { margin-bottom: 60px; }
        h1 { font-size: 48px; font-weight: 800; color: var(--text-h); line-height: 1; letter-spacing: -2px; margin: 0; }
        .subtitle { font-size: 18px; margin-top: 16px; color: var(--text-info); opacity: 0.8; }

        .summary-lead {
            font-size: 20px; color: var(--text-h); line-height: 1.6;
            margin-bottom: 60px; padding-left: 24px;
            border-left: 4px solid var(--accent-glow);
        }

        .section-box { margin-bottom: 60px; }
        .section-label { 
            font-size: 11px; font-weight: 800; color: var(--accent-glow); 
            letter-spacing: 4px; border-bottom: 1px solid var(--glass-border);
            padding-bottom: 12px; margin-bottom: 32px;
        }

        /* 洞察排版：卡片式流式布局 */
        .insight-layout { display: grid; gap: 40px; }
        .insight-card { display: flex; gap: 32px; align-items: flex-start; }
        .insight-index { 
            font-family: 'JetBrains Mono'; font-size: 32px; font-weight: 800; 
            color: var(--accent-glow); opacity: 0.2; line-height: 0.8; 
        }
        .insight-body h3 { font-size: 22px; color: var(--text-h); margin: 0 0 12px 0; }
        .insight-text { font-size: 16px; color: var(--text-p); text-align: justify; margin-bottom: 20px; }

        .evidence-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .ev-chip { 
            background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2);
            padding: 4px 12px; border-radius: 4px; font-size: 12px; color: var(--text-h);
        }

        /* 矩阵排版：紧凑网格 */
        .matrix-container {
            background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border);
            border-radius: var(--card-radius); overflow-x: auto;
        }
        .matrix-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .matrix-table th { text-align: left; padding: 12px 16px; background: rgba(255,255,255,0.02); }
        .matrix-table td { padding: 12px 16px; border-top: 1px solid var(--glass-border); }
        .cell-head { color: var(--text-info); font-weight: 700; opacity: 0.8; }
        .cell-num { font-family: 'JetBrains Mono'; text-align: right; }

        /* 建议列表 */
        .rec-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .rec-card { 
            background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); padding: 20px; border-radius: 12px;
            display: flex; gap: 16px; transition: transform 0.2s;
        }
        .rec-card:hover { transform: translateY(-4px); border-color: var(--accent-glow); }
        .rec-bullet { width: 8px; height: 8px; background: var(--accent-glow); border-radius: 50%; top: 8px; position: relative; flex-shrink: 0; box-shadow: 0 0 12px var(--accent-glow); }

        footer {
            margin-top: 40px; padding-top: 40px; border-top: 1px solid var(--glass-border);
            display: flex; justify-content: space-between; font-size: 10px; color: var(--text-dim);
        }

        .hidden { display: none; }
    </style>
</head>
<body>
    <div class="report-grid">
        <aside>
            <div class="aside-header">
                <div class="aside-tag">Metrics Snapshot</div>
                <div class="aside-ref">${escHtml(refId)}</div>
            </div>
            
            <div class="stat-sidebar-grid">
                ${keyMetricsArr.map(m => `
                <div class="stat-mini-card">
                    <div class="mini-label">${escHtml(m.label)}</div>
                    <div class="mini-value">${mdToHtml(m.value)}</div>
                    <div class="mini-viz">${createSparkline(m.trend, m.color || '#3b82f6')}</div>
                </div>`).join('')}
            </div>

            <div style="margin-top: auto; font-size: 10px; opacity: 0.3;">
                GENERATED BY LUCC-JS-CORE v3.1<br>
                ${escHtml(data.generatedAt || new Date().toLocaleString())}
            </div>
        </aside>

        <main>
            <header>
                <h1>${escHtml(data.title)}</h1>
                <div class="subtitle">${escHtml(data.subtitle)}</div>
            </header>

            <section class="summary-lead">
                ${mdToHtml(data.summary)}
            </section>

            <section class="section-box ${matrixHtml ? '' : 'hidden'}">
                <div class="section-label">01 // SPATIAL TRANSITION ANALYSIS</div>
                <div class="matrix-container">
                    <table class="matrix-table">
                        <thead>
                            <tr>
                                <th>FROM \\ TO</th>
                                <th class="cell-num">CROPLAND</th>
                                <th class="cell-num">FOREST</th>
                                <th class="cell-num">GRASS</th>
                                <th class="cell-num">BUILT</th>
                                <th class="cell-num">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${matrixRows.map(row => `
                            <tr>
                                <td class="cell-head">${escHtml(row.from)}</td>
                                <td class="cell-num">${escHtml(row.to_cropland || '0')}</td>
                                <td class="cell-num">${escHtml(row.to_forest || '0')}</td>
                                <td class="cell-num">${escHtml(row.to_grass || '0')}</td>
                                <td class="cell-num">${escHtml(row.to_built || '0')}</td>
                                <td class="cell-num" style="font-weight:800;">${escHtml(row.total || '0')}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </section>

            <section class="section-box ${insightsHtml ? '' : 'hidden'}">
                <div class="section-label">02 // DEEP DOMAIN INSIGHTS</div>
                <div class="insight-layout">
                    ${insights.map((ins, idx) => `
                    <div class="insight-card">
                        <div class="insight-index">0${idx + 1}</div>
                        <div class="insight-body">
                            <h3>${escHtml(ins.title || 'Analysis Conclusion')}</h3>
                            <div class="insight-text">${mdToHtml(ins.content)}</div>
                            ${ins.evidence && ins.evidence.length > 0 ? `
                            <div class="evidence-row">
                                ${ins.evidence.map(ev => `
                                <div class="ev-chip">${escHtml(ev.name)}: ${escHtml(ev.value)}</div>
                                `).join('')}
                            </div>` : ''}
                        </div>
                    </div>`).join('')}
                </div>
            </section>

            <section class="section-box ${recListHtml ? '' : 'hidden'}">
                <div class="section-label">03 // STRATEGIC RECOMMENDATIONS</div>
                <div class="rec-grid">
                    ${recommendations.map(rec => {
        const target = typeof rec === 'string' ? 'Policy Suggestion' : (rec.target || rec.goal || 'General Advisory');
        let content = typeof rec === 'string' ? rec : (rec.action || rec.actions || rec.content || '');
        if (Array.isArray(content)) content = content.join('；');
        return `
                        <div class="rec-card">
                            <div class="rec-bullet"></div>
                            <div>
                                <b style="color:var(--text-h); font-size: 14px;">${escHtml(target)}</b>
                                <p style="font-size: 13px; margin: 8px 0 0 0; line-height: 1.5;">${mdToHtml(content)}</p>
                            </div>
                        </div>`;
    }).join('')}
                </div>
            </section>

            <footer>
                <div>AUTHORED BY: ${escHtml(data.author || 'SYSTEM AI ANALYST')}</div>
                <div>&copy; 2026 GEOSPATIAL INTELLIGENCE PLATFORM</div>
            </footer>
        </main>
    </div>
</body>
</html>`;
}
