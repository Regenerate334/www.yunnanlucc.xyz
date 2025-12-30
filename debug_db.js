import pool from './server/config/db.js';

async function checkSchema() {
    try {
        const res2 = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'yunnan_country_level_city_boundaries'
    `);
        console.log('Columns List:');
        res2.rows.forEach(r => console.log(r.column_name));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkSchema();
