
import pool from '../server/config/db.js';

async function main() {
    const { rows } = await pool.query('SELECT * FROM public.clcd_transfer_matrix LIMIT 1');
    console.log(rows);
    process.exit(0);
}

main().catch(err => {
    console.error(err.message);
    process.exit(1);
});
