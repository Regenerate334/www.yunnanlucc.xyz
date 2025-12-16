import pkg from 'pg';
import fs from 'fs';
import path from 'path';
const { Pool } = pkg;

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'yunnan_CLCD'
});

const CLCD_CLASS_MAP = {
    1: 'Cropland',
    2: 'Forest',
    3: 'Shrub',
    4: 'Grassland',
    5: 'Water',
    6: 'SnowIce',
    7: 'Barren',
    8: 'Impervious',
    9: 'Wetland'
};

async function exportData() {
    try {
        console.log('开始导出数据...');

        // 1. 导出时间序列数据 (所有年份)
        console.log('正在查询时间序列数据...');
        const seriesQuery = `
      SELECT 
        year,
        landuse_type,
        SUM(area_sqm) / 1e6 AS area_km2,
        COUNT(*) as polygon_count
      FROM public.yunnan_clcd_merged_table
      WHERE area_sqm > 0
      GROUP BY year, landuse_type
      ORDER BY year, landuse_type
    `;

        const { rows: seriesRows } = await pool.query(seriesQuery);

        const seriesData = seriesRows.map(r => ({
            year: Number(r.year),
            class_code: Number(r.landuse_type),
            class_name: CLCD_CLASS_MAP[Number(r.landuse_type)] || `Unknown_${r.landuse_type}`,
            area_km2: Number(r.area_km2),
            polygon_count: Number(r.polygon_count)
        }));

        console.log(`✓ 时间序列数据: ${seriesData.length} 条记录`);

        // 2. 按年份分组的摘要数据
        const summaryByYear = {};
        seriesData.forEach(item => {
            if (!summaryByYear[item.year]) {
                summaryByYear[item.year] = [];
            }
            summaryByYear[item.year].push({
                class_code: item.class_code,
                class_name: item.class_name,
                area_km2: item.area_km2,
                polygon_count: item.polygon_count
            });
        });

        // 3. 创建 data 目录
        const dataDir = path.join(process.cwd(), 'server', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log('✓ 创建 data 目录');
        }

        // 4. 保存文件
        const seriesPath = path.join(dataDir, 'land_use_series.json');
        fs.writeFileSync(seriesPath, JSON.stringify(seriesData, null, 2), 'utf-8');
        console.log(`✓ 保存时间序列数据: ${seriesPath}`);

        const summaryPath = path.join(dataDir, 'land_use_summary.json');
        fs.writeFileSync(summaryPath, JSON.stringify(summaryByYear, null, 2), 'utf-8');
        console.log(`✓ 保存年度摘要数据: ${summaryPath}`);

        // 5. 显示统计信息
        console.log('\n=== 数据导出完成 ===');
        console.log(`年份范围: ${Math.min(...Object.keys(summaryByYear).map(Number))} - ${Math.max(...Object.keys(summaryByYear).map(Number))}`);
        console.log(`总记录数: ${seriesData.length}`);
        console.log(`文件大小: series=${(fs.statSync(seriesPath).size / 1024).toFixed(2)} KB, summary=${(fs.statSync(summaryPath).size / 1024).toFixed(2)} KB`);

        // 6. 显示 2023 年数据示例
        console.log('\n=== 2023年数据示例 ===');
        summaryByYear[2023].forEach(item => {
            console.log(`${item.class_name}: ${item.area_km2.toFixed(2)} km² (${(item.area_km2 / 10000).toFixed(2)} 万km²)`);
        });

        await pool.end();
        console.log('\n✓ 数据库连接已关闭');

    } catch (err) {
        console.error('导出失败:', err);
        process.exit(1);
    }
}

exportData();
