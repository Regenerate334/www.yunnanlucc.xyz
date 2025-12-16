import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'yunnan_CLCD'
});

async function testDatabase() {
    try {
        console.log('Testing database connection...');

        // Test 1: Check if table exists
        const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'yunnan_clcd_merged_table'
      );
    `);
        console.log('Table exists:', tableCheck.rows[0].exists);

        if (tableCheck.rows[0].exists) {
            // Test 2: Count total rows
            const countResult = await pool.query('SELECT COUNT(*) FROM public.yunnan_clcd_merged_table;');
            console.log('Total rows:', countResult.rows[0].count);

            // Test 3: Check 2023 data
            const count2023 = await pool.query('SELECT COUNT(*) FROM public.yunnan_clcd_merged_table WHERE year = 2023;');
            console.log('Rows for year 2023:', count2023.rows[0].count);

            // Test 4: Sample data
            const sample = await pool.query('SELECT * FROM public.yunnan_clcd_merged_table LIMIT 5;');
            console.log('Sample data:', JSON.stringify(sample.rows, null, 2));

            // Test 5: Check column names
            const columns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'yunnan_clcd_merged_table';
      `);
            console.log('Columns:', JSON.stringify(columns.rows, null, 2));
        }

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

testDatabase();
