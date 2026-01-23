import pool from './server/config/db.js';

async function checkSpecificYears() {
    try {
        const years = [1999, 2011];
        for (const year of years) {
            const { rows } = await pool.query(`
                SELECT land_use_type, area 
                FROM clcd_province 
                WHERE year = $1 AND LOWER(land_use_type) = 'cropland'
            `, [year]);
            console.log(`Year ${year} Cropland:`, rows);
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSpecificYears();
