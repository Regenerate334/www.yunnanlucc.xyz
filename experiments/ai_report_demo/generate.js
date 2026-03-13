import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { reportData } from './data.js';
import { getTemplate } from './template.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateReport() {
    console.log('🚀 正在生成 AI 报表原型...');

    try {
        const html = getTemplate(reportData);
        const outputPath = path.join(__dirname, 'report.html');

        fs.writeFileSync(outputPath, html);

        console.log('\n✅ 报表生成成功！');
        console.log(`📍 文件路径: ${outputPath}`);
        console.log('\n请在浏览器中打开该文件查看 Stunning 效果。');

    } catch (err) {
        console.error('❌ 报表生成失败:', err);
    }
}

generateReport();
