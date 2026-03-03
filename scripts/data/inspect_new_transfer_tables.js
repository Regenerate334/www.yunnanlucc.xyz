
import pool from '../config/db.js';

async function checkTable(tableName) {
    try {
        console.log(`\n\n---------------------------------------------------`);
        console.log(`Checking table: ${tableName}`);
        console.log(`---------------------------------------------------`);

        // Get all columns
        const res = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = $1
            ORDER BY ordinal_position;
        `, [tableName]);

        if (res.rows.length === 0) {
            console.log('Table NOT FOUND.');
            return;
        }

        const columns = res.rows.map(r => r.column_name);
        console.log(`Total columns: ${columns.length}`);

        // ID and Geometry
        const idCols = columns.filter(c => ['id', 'gid', 'ogc_fid', 'adcode', 'city', 'cnt_name', 'name'].includes(c.toLowerCase()) || c.toLowerCase().includes('id'));
        console.log('Identity/Name columns:', idCols.join(', '));

        // Check for geometry by name AND type
        const geomCols = res.rows.filter(r =>
            ['geom', 'wkb_geometry', 'geometry', 'shape'].includes(r.column_name.toLowerCase()) ||
            r.data_type === 'USER-DEFINED' ||
            r.udt_name === 'geometry'
        );

        if (geomCols.length > 0) {
            console.log('Geometry columns found:', geomCols.map(c => `${c.column_name} (${c.udt_name})`).join(', '));
        } else {
            console.log('Geometry column: NONE');
        }

        // Data pattern
        const dataColumns = columns.filter(c => c.match(/^y\d{4}_\d+$/));
        if (dataColumns.length > 0) {
            console.log(`Data columns count: ${dataColumns.length}`);
            const periods = new Set(dataColumns.map(c => c.split('_')[0]));
            const sortedPeriods = Array.from(periods).sort();
            console.log('Periods covered:', sortedPeriods.join(', '));
            console.log('Sample data columns:', dataColumns.slice(0, 3).join(', '));
        } else {
            console.log('No data columns matching pattern yYYyy_FROMTO found.');
        }

        // Row count
        const count = await pool.query(`SELECT count(*) FROM public."${tableName}"`);
        console.log('Total rows:', count.rows[0].count);

    } catch (err) {
        console.error(`Error checking ${tableName}:`, err.message);
    }
}

async function main() {
    await checkTable('spatial_county_yunnan_transfer');
    await checkTable('spatial_grid_yunnan_transfer');
    pool.end();
}

main();
