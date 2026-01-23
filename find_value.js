import pool from './server/config/db.js';

async function findValue() {
    try {
        // Check clcd_province
        const { rows: pRows } = await pool.query(`
            SELECT * FROM clcd_province 
            WHERE area::text LIKE '79877%'
        `);
        if (pRows.length > 0) console.log('Found in clcd_province:', pRows);

        // Check clcd_prefecture
        const { rows: prefRows } = await pool.query(`
            SELECT * FROM clcd_prefecture 
            WHERE cropland::text LIKE '79877%'
        `);
        if (prefRows.length > 0) console.log('Found in clcd_prefecture:', prefRows);

        // Check clcd_county
        const { rows: cRows } = await pool.query(`
            SELECT * FROM clcd_county 
            WHERE cropland::text LIKE '79877%'
        `);
        if (cRows.length > 0) console.log('Found in clcd_county:', cRows);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

findValue();
