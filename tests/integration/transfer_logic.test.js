
import pool from '../config/db.js';

async function verifyData() {
    try {
        console.log(`\n=== Verifying Data Logic ===`);

        // 1. Compare Row Counts
        const countCounty = await pool.query(`SELECT count(*) FROM public.spatial_county_yunnan_transfer`);
        const countGrid = await pool.query(`SELECT count(*) FROM public.spatial_grid_yunnan_transfer`);

        console.log(`County Table Rows: ${countCounty.rows[0].count} (Expected ~129)`);
        console.log(`Grid Table Rows:   ${countGrid.rows[0].count} (Expected ~4178)`);

        if (countCounty.rows[0].count === countGrid.rows[0].count) {
            console.warn(`[!] CRITICAL: County table has exact same row count as Grid table.`);
        }

        // Get all column names for subsequent checks
        const colsRes = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'spatial_county_yunnan_transfer'
        `);
        const allCols = colsRes.rows.map(c => c.column_name);

        // 2. Check for Class 9 (Wetland in old, but should be 8 in new)
        // User says: 1-8 classes. So 9 should NOT exist in column mapping.
        console.log(`\nChecking for Class 9 (Invalid in new 1-8 schema)...`);

        // Regex: y\d{4}_9\d OR y\d{4}_\d9
        const class9Cols = allCols.filter(c => c.match(/^y\d{4}_(9\d|\d9)$/));

        if (class9Cols.length > 0) {
            console.warn(`[!] Found ${class9Cols.length} columns involving Class 9: ${class9Cols.slice(0, 5).join(', ')}...`);
            // Check data sum
            const sumExpr = class9Cols.map(c => `COALESCE("${c}", 0)`).join(' + ');
            const sumQuery = `SELECT SUM(${sumExpr}) as total_class_9 FROM public.spatial_county_yunnan_transfer`;
            const sumRes = await pool.query(sumQuery);
            console.log(`Total Area for Class 9: ${sumRes.rows[0].total_class_9}`);
        } else {
            console.log(`[OK] No Class 9 columns found. Schema complies with 1-8 classification.`);
        }

        // 3. Check Class 3 (Shrub) in County Table
        console.log(`\nChecking Class 3 (Shrub) in County Table...`);
        // Find columns starting with y and containing _3_ (middle) or _3 (end) or 3_ (start of suffix)
        // Adjust regex for yYYYY_FROMTO format. 
        // We look for _3x or _x3.

        // Regex: y\d{4}_(3\d|\d3) (from 3 to X) OR y\d{4}_\d3 (from X to 3)
        // But exclude '33' if it exists (3 to 3)
        const class3Cols = allCols.filter(c => c.match(/^y\d{4}_(3\d|\d3)$/));

        if (class3Cols.length > 0) {
            console.log(`Found ${class3Cols.length} columns involving Class 3.`);

            // Check if ALL are zero
            // We construct a query to sum them all
            const sumExpr = class3Cols.map(c => `COALESCE("${c}", 0)`).join(' + ');
            const sumQuery = `SELECT SUM(${sumExpr}) as total_class_3 FROM public.spatial_county_yunnan_transfer`;

            const sumRes = await pool.query(sumQuery);
            const totalClass3 = parseFloat(sumRes.rows[0].total_class_3);

            console.log(`Total Area for Class 3 (All Years/Transfers): ${totalClass3}`);
            if (totalClass3 === 0) {
                console.log(`[OK] Class 3 columns exist but contain 0 data. Reclassification confirmed.`);
            } else {
                console.warn(`[!] WARN: Class 3 data is NOT zero. Reclassification might be missing.`);
            }
        } else {
            console.log(`[OK] No Class 3 columns found.`);
        }

        // 4. Inspect County Table Identity and Geometry
        console.log(`\nInspecting County Table IDs and Geometry Type...`);
        const idSample = await pool.query(`SELECT "OBJECTID", "InPoly_FID" FROM public.spatial_county_yunnan_transfer LIMIT 5`);
        console.table(idSample.rows);
        // Check geometry type
        const geomTypeRes = await pool.query(`
            SELECT GeometryType("Shape") as gtype, SRID("Shape") as srid 
            FROM public.spatial_county_yunnan_transfer LIMIT 1
        `);
        if (geomTypeRes.rows.length > 0) {
            console.log(`Geometry Type: ${geomTypeRes.rows[0].gtype}, SRID: ${geomTypeRes.rows[0].srid}`);
        } else {
            console.log(`No geometry found.`);
        }

    } catch (err) {
        console.error(`Error:`, err.message);
    } finally {
        pool.end();
    }
}

verifyData();
