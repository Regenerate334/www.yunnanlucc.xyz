import pool from './server/config/db.js';

async function run() {
    const yearList = [
        1985, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999,
        2001, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012,
        2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023
    ];

    const prefixes = ['cro', 'for', 'shr', 'gra', 'wat', 'ice', 'bar', 'imp', 'wet'];
    const tables = ['spatial_county_yunnan_stats', 'spatial_grid_yunnan_stats'];

    try {
        for (const tableName of tables) {
            console.log(`Processing table: ${tableName}`);
            for (const prefix of prefixes) {
                // Find existing sq_ columns for this prefix
                const { rows } = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 
          AND column_name LIKE $2
          ORDER BY column_name
        `, [tableName, `${prefix}_sq_%`]);

                console.log(`  Prefix ${prefix}: found ${rows.length} columns`);

                for (let i = 0; i < rows.length; i++) {
                    if (i >= yearList.length) break; // Don't rename extra ones

                    const oldName = rows[i].column_name;
                    const newName = `${prefix}_${yearList[i]}`;

                    if (oldName === newName) continue;

                    try {
                        await pool.query(`ALTER TABLE public."${tableName}" RENAME COLUMN "${oldName}" TO "${newName}"`);
                        // console.log(`    Renamed ${oldName} -> ${newName}`);
                    } catch (e) {
                        if (e.code === '42701') {
                            // Column already exists, maybe partially renamed
                            continue;
                        }
                        console.error(`    Error renaming ${oldName}:`, e.message);
                    }
                }
            }
        }
        console.log('Renaming completed successfully.');
        process.exit(0);
    } catch (e) {
        console.error('Fatal error:', e);
        process.exit(1);
    }
}

run();
