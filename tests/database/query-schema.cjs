const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'yunnan_CLCD'
});

async function querySchema() {
    console.log('=== 查询 spatial_county_yunnan_stats 表结构 ===\n');
    const countyRes = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'spatial_county_yunnan_stats'
        ORDER BY ordinal_position
    `);

    console.log('县级空间表字段 (共 ' + countyRes.rows.length + ' 个):');
    const countyFields = countyRes.rows.map(c => c.column_name);
    console.log(countyFields.join(', '));

    // 统计各地类字段数量
    const prefixes = ['cro', 'for', 'shr', 'gra', 'wat', 'ice', 'bar', 'imp', 'wet'];
    console.log('\n各地类字段统计:');
    prefixes.forEach(p => {
        const cols = countyFields.filter(f => f.startsWith(p + '_'));
        console.log(`  ${p}: ${cols.length} 个字段`);
        if (cols.length > 0) console.log(`    示例: ${cols.slice(0, 3).join(', ')}...`);
    });

    console.log('\n\n=== 查询 spatial_grid_yunnan_stats 表结构 ===\n');
    const gridRes = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'spatial_grid_yunnan_stats'
        ORDER BY ordinal_position
    `);

    console.log('格网空间表字段 (共 ' + gridRes.rows.length + ' 个):');
    const gridFields = gridRes.rows.map(c => c.column_name);
    console.log(gridFields.join(', '));

    console.log('\n各地类字段统计:');
    prefixes.forEach(p => {
        const cols = gridFields.filter(f => f.startsWith(p + '_'));
        console.log(`  ${p}: ${cols.length} 个字段`);
    });

    // 检查现有年份列表
    console.log('\n\n=== 可用年份 ===');
    const yearsRes = await pool.query('SELECT DISTINCT year FROM public.clcd_province ORDER BY year');
    console.log('年份列表:', yearsRes.rows.map(r => r.year).join(', '));
    console.log('总计:', yearsRes.rows.length, '个年份');

    // 检查县级数据记录数
    console.log('\n\n=== 数据记录数 ===');
    const countyCount = await pool.query('SELECT COUNT(*) FROM public.spatial_county_yunnan_stats');
    console.log('县级空间表记录数:', countyCount.rows[0].count);

    const gridCount = await pool.query('SELECT COUNT(*) FROM public.spatial_grid_yunnan_stats');
    console.log('格网空间表记录数:', gridCount.rows[0].count);

    await pool.end();
}

querySchema().catch(err => {
    console.error('Error:', err);
    pool.end();
});
