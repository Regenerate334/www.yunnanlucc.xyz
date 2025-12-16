import pkg from 'pg';
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

async function test2023Data() {
    try {
        console.log('Testing 2023 summary query...');

        const sql = `
      SELECT 
        landuse_type, 
        SUM(area_sqm) / 1e6 AS area_km2,
        COUNT(*) as polygon_count
      FROM public.yunnan_clcd_merged_table
      WHERE year = $1
        AND area_sqm > 0
      GROUP BY landuse_type
      ORDER BY landuse_type
      LIMIT 20
    `;

        const { rows } = await pool.query(sql, [2023]);

        const mapped = rows.map(r => ({
            class_code: Number(r.landuse_type),
            class_name: CLCD_CLASS_MAP[Number(r.landuse_type)] || `Unknown_${r.landuse_type}`,
            area_km2: Number(r.area_km2),
            polygon_count: Number(r.polygon_count)
        }));

        console.log('Results:', JSON.stringify(mapped, null, 2));
        console.log('\nTotal area:', mapped.reduce((sum, item) => sum + item.area_km2, 0).toFixed(2), 'km²');

        // Check Forest specifically
        const forest = mapped.find(item => item.class_name === 'Forest');
        if (forest) {
            console.log('\nForest area:', forest.area_km2.toFixed(2), 'km²');
            console.log('Forest area in 万km²:', (forest.area_km2 / 10000).toFixed(2), '万km²');
        }

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

test2023Data();
