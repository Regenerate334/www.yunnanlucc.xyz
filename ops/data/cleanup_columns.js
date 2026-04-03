
import 'dotenv/config';
import pool from '../../server/config/db.js';

async function cleanupTable(tableName) {
    try {
        console.log(`\n\n---------------------------------------------------`);
        console.log(`Checking table: ${tableName}`);
        console.log(`---------------------------------------------------`);

        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = $1
        `, [tableName]);

        const columns = res.rows.map(r => r.column_name);

        // Find redundant objectids
        // Pattern: objectid followed by ANYTHING (numbers, underscores) except exact match 'objectid' or 'OBJECTID'
        // Also look for 'gid' redundancy if any, but user specified objectid.
        // We will keep 'objectid' (case-insensitive) and 'gid'.

        const redundant = columns.filter(c => {
            const lower = c.toLowerCase();
            return lower.startsWith('objectid') && lower !== 'objectid';
        });

        if (redundant.length > 0) {
            console.log(`Found ${redundant.length} redundant columns:`);
            console.log(redundant.join(', '));

            // Generate DROP commands
            const dropQueries = redundant.map(c => `ALTER TABLE public."${tableName}" DROP COLUMN "${c}";`);
            console.log('\nGenerated DROP commands (NOT EXECUTED):');
            dropQueries.forEach(q => console.log(q));

            // Execute?
            if (process.argv.includes('--execute')) {
                console.log('\nExecuting DROP commands...');
                for (const q of dropQueries) {
                    await pool.query(q);
                    console.log(`Executed: ${q}`);
                }
                console.log('Cleanup complete.');
            } else {
                console.log('\nRun with --execute to apply changes.');
            }

        } else {
            console.log('No redundant objectid columns found.');
        }

    } catch (err) {
        console.error(`Error processing ${tableName}:`, err.message);
    }
}

async function main() {
    await cleanupTable('spatial_county_yunnan_transfer');
    await cleanupTable('spatial_grid_yunnan_transfer');
    pool.end();
}

main();
