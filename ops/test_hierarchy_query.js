import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new pg.Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
});

async function testQuery() {
    try {
        const sql = `
            SELECT DISTINCT "地级" as prefecture, "县级" as county 
            FROM public.yunnan_country_level_city_boundaries 
            WHERE "省级" = '云南省' 
            ORDER BY "地级", "县级"
        `;
        const { rows } = await pool.query(sql);
        console.log(`Query returned ${rows.length} rows.`);

        const hierarchy = {};
        rows.forEach(row => {
            if (row.prefecture) {
                if (!hierarchy[row.prefecture]) {
                    hierarchy[row.prefecture] = [];
                }
                if (row.county) {
                    hierarchy[row.prefecture].push(row.county);
                }
            }
        });

        const result = Object.keys(hierarchy).map(pref => ({
            name: pref,
            children: hierarchy[pref]
        }));

        console.log('Final hierarchy structure sample (first 2):');
        console.log(JSON.stringify(result.slice(0, 2), null, 2));
    } catch (err) {
        console.error('Query Error:', err.message);
    } finally {
        await pool.end();
    }
}

testQuery();
