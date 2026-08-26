const escapeHtml = (value = '') => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

export const buildDirectReportHtml = ({
  title,
  bodyHtml,
  meta = {},
  modelLabel = '未知模型'
}) => {
  const now = new Date().toLocaleString('zh-CN', { hour12: false });
  const scope = [meta.region, meta.year ? `${meta.year}年` : ''].filter(Boolean).join(' · ');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --report-blue: #1a365d;
      --report-blue-2: #2a4a8a;
      --report-ink: #1f2937;
      --report-muted: #64748b;
      --report-line: #dbe3ed;
      --report-paper: #ffffff;
    }
    body {
      font-family: "Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif;
      font-size: 14px;
      line-height: 1.8;
      color: var(--report-ink);
      background: #f4f6f8;
    }
    .report-page {
      max-width: 860px;
      margin: 40px auto;
      overflow: hidden;
      border-radius: 8px;
      background: var(--report-paper);
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    }
    .report-header {
      padding: 40px 52px 36px;
      color: #fff;
      background: linear-gradient(135deg, var(--report-blue) 0%, var(--report-blue-2) 100%);
    }
    .report-header .tag {
      margin-bottom: 16px;
      color: rgba(255, 255, 255, 0.58);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 3px;
    }
    .report-header h1 {
      margin-bottom: 12px;
      color: #fff;
      font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif;
      font-size: 28px;
      font-weight: 700;
      line-height: 1.35;
    }
    .report-header .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 20px;
      color: rgba(255, 255, 255, 0.56);
      font-size: 12px;
    }
    .report-header .meta span::before { content: "▪ "; opacity: 0.45; }
    .report-body { padding: 44px 52px 52px; }
    .md-content h1, .md-content h2, .md-content h3,
    .md-content h4, .md-content h5, .md-content h6 {
      margin-top: 2em;
      margin-bottom: 0.65em;
      color: var(--report-blue);
      font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif;
      line-height: 1.45;
      break-after: avoid-page;
    }
    .md-content > :first-child { margin-top: 0; }
    .md-content h1 { padding-bottom: 8px; border-bottom: 2px solid var(--report-blue-2); font-size: 22px; }
    .md-content h2 { padding-bottom: 6px; border-bottom: 1px solid var(--report-line); font-size: 18px; }
    .md-content h3 { font-size: 16px; }
    .md-content h4, .md-content h5, .md-content h6 { font-size: 14px; }
    .md-content p {
      margin-bottom: 1em;
      color: #2d3748;
      text-align: justify;
      text-indent: 2em;
      overflow-wrap: anywhere;
      orphans: 2;
      widows: 2;
    }
    .md-content > p:first-child,
    .md-content h1 + p, .md-content h2 + p, .md-content h3 + p,
    .md-content h4 + p, .md-content h5 + p, .md-content h6 + p,
    .md-content li > p, .md-content blockquote p,
    .md-content td p, .md-content th p { text-indent: 0; }
    .md-content strong { color: #1f2937; font-weight: 700; }
    .md-content em { color: #4a5568; }
    .md-content a { color: #245ca6; text-decoration: none; overflow-wrap: anywhere; }
    .md-content ul, .md-content ol { margin: 0.45em 0 1em; padding-left: 1.7em; }
    .md-content li { margin-bottom: 0.45em; color: #2d3748; break-inside: avoid-page; }
    .md-content li > ul, .md-content li > ol { margin-top: 0.3em; margin-bottom: 0; }
    .md-content .table-container {
      margin: 1.5em 0;
      overflow-x: auto;
      border: 1px solid var(--report-line);
      border-radius: 6px;
      break-inside: auto;
    }
    .md-content table { width: 100%; margin: 0; border-collapse: collapse; font-size: 13px; }
    .md-content thead { display: table-header-group; }
    .md-content thead tr { color: #fff; background: var(--report-blue); }
    .md-content th { padding: 10px 14px; font-weight: 600; text-align: left; white-space: nowrap; }
    .md-content td { padding: 9px 14px; border-bottom: 1px solid var(--report-line); color: #2d3748; }
    .md-content tbody tr:nth-child(even) { background: #f7f8fa; }
    .md-content tr { break-inside: avoid-page; }
    .md-content blockquote {
      margin: 1.2em 0;
      padding: 12px 18px;
      border-left: 4px solid var(--report-blue-2);
      border-radius: 0 5px 5px 0;
      color: #2c5282;
      background: #eef4fb;
      break-inside: avoid-page;
    }
    .md-content blockquote p { margin: 0; color: inherit; }
    .md-content code {
      padding: 2px 6px;
      border-radius: 3px;
      color: #9b2c2c;
      background: #edf2f7;
      font-family: Consolas, "Courier New", monospace;
      font-size: 12px;
    }
    .md-content pre {
      margin: 1.2em 0;
      padding: 16px 20px;
      overflow-x: auto;
      border-radius: 6px;
      color: #e2e8f0;
      background: #1a202c;
      font-size: 12px;
      line-height: 1.6;
      break-inside: avoid-page;
    }
    .md-content pre code { padding: 0; color: inherit; background: none; font-size: inherit; }
    .md-content img { display: block; max-width: 100%; height: auto; margin: 1.25em auto; }
    .md-content .katex-display { margin: 1.25em 0; overflow-x: auto; overflow-y: hidden; text-align: center; }
    .md-content .mermaid {
      margin: 1.35em 0;
      padding: 14px;
      overflow-x: auto;
      border: 1px solid var(--report-line);
      border-radius: 5px;
      background: #f8fafc;
      text-align: center;
      white-space: pre-wrap;
    }
    .md-content .mermaid svg { display: block; max-width: 100%; height: auto; margin: 0 auto; }
    .md-content .md-stream-tail { display: block; }
    .md-content hr { margin: 2em 0; border: 0; border-top: 1px solid var(--report-line); }
    .report-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 52px;
      border-top: 1px solid var(--report-line);
      color: #94a3b8;
      background: #fafbfc;
      font-size: 11px;
    }
    @page { size: A4; margin: 15mm 16mm 17mm; }
    @media print {
      body { background: #fff; }
      .report-page { max-width: none; margin: 0; border-radius: 0; box-shadow: none; }
      .report-header, .md-content thead tr, .md-content tbody tr:nth-child(even) {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .md-content h1, .md-content h2, .md-content h3 { break-after: avoid-page; }
      .md-content .table-container { overflow: visible; break-inside: auto; }
      .md-content table { break-inside: auto; }
      .md-content tr, .md-content pre, .md-content blockquote { break-inside: avoid-page; }
    }
    @media (max-width: 720px) {
      .report-page { margin: 0; border-radius: 0; }
      .report-header { padding: 30px 26px 28px; }
      .report-header h1 { font-size: 24px; }
      .report-body { padding: 30px 26px 38px; }
      .report-footer { align-items: flex-start; flex-direction: column; padding: 16px 26px; }
    }
  </style>
</head>
<body>
  <main class="report-page">
    <header class="report-header">
      <div class="tag">AI 分析报告 · GIS INTELLIGENCE PLATFORM</div>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">
        <span>AI 模型：${escapeHtml(modelLabel)}</span>
        ${scope ? `<span>分析范围：${escapeHtml(scope)}</span>` : ''}
        <span>生成时间：${escapeHtml(now)}</span>
      </div>
    </header>
    <article class="report-body">
      <div class="md-content">${bodyHtml}</div>
    </article>
    <footer class="report-footer">
      <span>© 昆明理工大学国土资源工程学院 彭派GIS课题组</span>
      <span>${escapeHtml(now)}</span>
    </footer>
  </main>
</body>
</html>`;
};
