async function testHierarchy() {
    try {
        // Since I don't have a token easily available here without logging in, 
        // and I don't want to mess with the user's session, 
        // I'll just check if the server is responding to the health check.
        const health = await fetch('http://localhost:3000/health');
        console.log('Server Health:', health.status);

        // I'll also check the DB directly to see what the hierarchy query would return.
    } catch (e) {
        console.error('Server is down:', e.message);
    }
}

import pool from './server/config/db.js';
async function checkDbHierarchy() {
    try {
        const sql = `
            SELECT DISTINCT "地级" as prefecture, "县级" as county 
            FROM public.yunnan_country_level_city_boundaries 
            WHERE "省级" = '云南省' 
            ORDER BY "地级", "县级"
        `;
        const { rows } = await pool.query(sql);
        console.log('Hierarchy Rows Count:', rows.length);
        if (rows.length > 0) {
            console.log('Sample Row:', rows[0]);
        }
        process.exit(0);
    } catch (e) {
        console.error('DB Error:', e.message);
        process.exit(1);
    }
}

checkDbHierarchy();
