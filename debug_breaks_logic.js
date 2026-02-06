import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function simulateGetBreaks(reqQuery) {
    const { attr = 'cropland', year = 1990, unit = 'county', method = 'quantile', classes = 8 } = reqQuery;
    console.log(`Running simulation with:`, reqQuery);

    const attrPrefixMap = {
        cropland: 'cro', forest: 'for', shrub: 'shr', grassland: 'gra',
        water: 'wat', wetland: 'wet', impervious: 'imp', barren: 'bar', snow_ice: 'ice'
    };

    const prefix = attrPrefixMap[attr];
    let fieldName = `${prefix}_sq_${String(year).slice(-3)}`;

    try {
        console.log('1. Getting columns...');
        const colsSql = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = $1 
              AND column_name LIKE '${prefix}_sq_%'
            ORDER BY column_name
        `;
        const tableName = unit === 'grid' ? 'spatial_grid_yunnan_stats' : 'spatial_county_yunnan_stats';
        console.log(`Table Name: ${tableName}`);

        const { rows: colRows } = await pool.query(colsSql, [tableName]);
        const dbCols = colRows.map(r => r.column_name);
        console.log(`Found ${dbCols.length} columns:`, dbCols);

        console.log('2. Getting years...');
        const yearSql = 'SELECT DISTINCT year FROM public.clcd_province ORDER BY year';
        const { rows: yearRows } = await pool.query(yearSql);
        const years = yearRows.map(r => r.year);
        console.log(`Found ${years.length} years (first 5):`, years.slice(0, 5));

        console.log('3. Mapping...');
        const yearIndex = years.indexOf(Number(year));
        let matchedCol = null;

        console.log(`Target Year: ${year}, Year Index: ${yearIndex}`);

        if (yearIndex !== -1 && yearIndex < dbCols.length) {
            matchedCol = dbCols[yearIndex];
            if (dbCols.length === years.length) {
                fieldName = matchedCol;
                console.log(`Mapped by exact index match: ${fieldName}`);
            } else {
                const simpleMatch = `${prefix}_sq_${String(year).slice(-3)}`;
                if (dbCols.includes(simpleMatch)) {
                    fieldName = simpleMatch;
                    console.log(`Mapped by simple suffix match: ${fieldName}`);
                } else {
                    fieldName = matchedCol;
                    console.log(`Mapped by index fallback: ${fieldName}`);
                }
            }
        } else {
            console.log('Year index out of bounds or not found!');
        }

        console.log(`Final Field Name: ${fieldName}`);

        // Check if field exists
        if (!dbCols.includes(fieldName)) {
            console.log(`Field ${fieldName} NOT FOUND in dbCols list.`);
        }

        console.log('4. Getting Stats...');
        // 获取基本统计信息
        const numClasses = Math.min(Math.max(parseInt(classes), 3), 12);

        const statsSql = `
            SELECT 
                min(${fieldName}) as min_val,
                max(${fieldName}) as max_val,
                avg(${fieldName}) as avg_val,
                count(${fieldName}) as count_val
            FROM public.${tableName}
            WHERE ${fieldName} IS NOT NULL AND ${fieldName} > 0
        `;
        const { rows: [statsRow] } = await pool.query(statsSql);
        const stats = {
            min: Number(statsRow.min_val) / 1000000,
            max: Number(statsRow.max_val) / 1000000,
            avg: Number(statsRow.avg_val) / 1000000,
            raw_max: statsRow.max_val
        };
        console.log('Stats:', stats);

        if (method === 'quantile') {
            console.log('Calculating Quantile Breaks...');
            const percentiles = [];
            for (let i = 1; i < numClasses; i++) {
                percentiles.push(i / numClasses);
            }

            const percentileSql = `
                SELECT percentile_cont(ARRAY[${percentiles.join(',')}]) 
                WITHIN GROUP (ORDER BY ${fieldName}) as breaks
                FROM public.${tableName}
                WHERE ${fieldName} IS NOT NULL AND ${fieldName} > 0
            `;
            const { rows: [percRow] } = await pool.query(percentileSql);
            if (percRow && percRow.breaks) {
                const breaks = [stats.min, ...percRow.breaks.map(v => Number(v) / 1000000), stats.max];
                console.log('Calculated Breaks (km²):', breaks);
            } else {
                console.log('No breaks returned (null?)');
            }
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

simulateGetBreaks({ attr: 'cropland', year: 1990, unit: 'grid', method: 'quantile', classes: 8 });
