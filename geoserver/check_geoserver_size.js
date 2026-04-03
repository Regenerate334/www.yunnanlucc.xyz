import fs from 'fs';
import path from 'path';

function getFolderSize(folderPath) {
    let totalSize = 0;
    try {
        const files = fs.readdirSync(folderPath);
        for (const file of files) {
            const fullPath = path.join(folderPath, file);
            try {
                const stats = fs.statSync(fullPath);
                if (stats.isDirectory()) {
                    totalSize += getFolderSize(fullPath);
                } else {
                    totalSize += stats.size;
                }
            } catch (err) { }
        }
    } catch (err) { }
    return totalSize;
}

const targetPath = 'E:\\GeoServer\\GerServer_Data';

console.log(`\n🔍 正在检查真实的 GeoServer 数据目录: ${targetPath}`);

if (fs.existsSync(targetPath)) {
    console.log('✅ 目录存在！正在计算文件夹体积，请稍候...');
    const sizeBytes = getFolderSize(targetPath);
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
    const sizeGB = (sizeBytes / (1024 * 1024 * 1024)).toFixed(2);

    if (sizeBytes > 1024 * 1024 * 1024) {
        console.log(`📦 \x1b[36m${targetPath}\x1b[0m 总大小: \x1b[32m${sizeGB} GB\x1b[0m`);
    } else {
        console.log(`📦 \x1b[36m${targetPath}\x1b[0m 总大小: \x1b[32m${sizeMB} MB\x1b[0m`);
    }
} else {
    console.log(`❌ 目录不存在: ${targetPath}`);
}
