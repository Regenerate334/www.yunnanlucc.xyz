
const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'yunnan_CLCD',
    password: 'password',
    port: 5432,
});

async function run() {
    try {
        console.log('--- CHECKING TREND FOR ID ---');

        const sql = `
            SELECT 
                SUM(imp_sq_198) as s198,
                SUM(imp_sq_199) as s199_imp,
                SUM(ipm_sq_199) as s199_ipm,
                SUM(imp_sq_200) as s200,
                SUM(imp_sq_221) as s221,
                SUM(imp_sq_231) as s231
            FROM spatial_grid_yunnan_stats
        `;

        const { rows } = await pool.query(sql);
        const r = rows[0];

        // Format helper
        const fmt = (n) => (Number(n) / 1000000).toFixed(2) + ' km2';

        console.log(`198: ${fmt(r.s198)}`);
        console.log(`199 (imp): ${fmt(r.s199_imp)}`);
        console.log(`199 (ipm): ${fmt(r.s199_ipm)} <--- Typo Column`);
        console.log(`200: ${fmt(r.s200)}`);
        console.log(`...`);
        console.log(`221: ${fmt(r.s221)}`);
        console.log(`231: ${fmt(r.s231)}`);

        const v199 = Number(r.s199_imp);
        const vTypo = Number(r.s199_ipm);
        const v231 = Number(r.s231);

        // Analysis
        console.log('\n--- ANALYSIS ---');
        const diff199 = Math.abs(vTypo - v199);
        const diff231 = Math.abs(vTypo - v231);

        console.log(`Gap from 1999(imp): ${fmt(diff199)}`);
        console.log(`Gap from 2021(imp): ${fmt(diff231)}`);

        if (diff231 < diff199) {
            console.log('HYPOTHESIS: ipm_sq_199 looks like 2021/2023 data!');
        } else {
            console.log('HYPOTHESIS: ipm_sq_199 looks like 1999 data (maybe just different source?)');
        }

    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        pool.end();
    }
}

run();
