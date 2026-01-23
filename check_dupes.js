import pool from './server/config/db.js';

async function checkDuplicates() {
    try {
        const { rows } = await pool.query(`
            SELECT year, land_use_type, COUNT(*) 
            FROM clcd_province 
            GROUP BY year, land_use_type 
            HAVING COUNT(*) > 1
        `);
        console.log('Duplicates in clcd_province:', rows);

        const { rows: all1999 } = await pool.query(`
            SELECT * FROM clcd_province WHERE year = 1999 AND LOWER(land_use_type) = 'cropland'
        `);
        console.log('All 1999 cropland rows:', all1999);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDuplicates();
