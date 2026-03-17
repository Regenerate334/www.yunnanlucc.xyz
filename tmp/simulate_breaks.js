import pool from '../server/config/db.js';
import { getJenksBreaks } from '../server/routes/clcd/utils.js';

async function simulateBreaksHandler() {
    const query = {
        mode: 'rate',
        attr: 'reclamation',
        year: '2023',
        unit: 'county',
        classes: '9',
        method: 'jenks'
    };

    const { mode, attr, year, unit, classes } = query;

    try {
        console.log('Simulating mode=rate handler...');
        const tableName = unit === 'grid' ? 'spatial_rates_grid' : 'spatial_rates_county';
        const numClasses = Math.min(Math.max(parseInt(classes), 3), 12);
        const targetYear = parseInt(year);
        const rateField = attr === 'reclamation' ? 'reclamation_rate' : 'conversion_rate';

        console.log(`Target: ${tableName}, Field: ${rateField}, Year: ${targetYear}`);

        // 1. 获取统计数据
        const statsSql = `
            SELECT 
                min(${rateField}) as min_val,
                max(${rateField}) as max_val,
                avg(${rateField}) as avg_val,
                count(*) as count_val
            FROM public."${tableName}"
            WHERE year = $1 AND ${rateField} IS NOT NULL
        `;
        const { rows: [statsRow] } = await pool.query(statsSql, [targetYear]);
        const stats = {
            min: Number(statsRow?.min_val || 0),
            max: Number(statsRow?.max_val || 0),
            avg: Number(statsRow?.avg_val || 0),
            count: Number(statsRow?.count_val || 0)
        };
        console.log('Stats:', stats);

        // 2. 获取数据进行分级
        const dataSql = `
            SELECT ${rateField} as val
            FROM public."${tableName}"
            WHERE year = $1 AND ${rateField} IS NOT NULL
            ORDER BY val ASC
        `;
        const { rows: allRows } = await pool.query(dataSql, [targetYear]);
        let dataValues = allRows.map(r => Number(r.val));
        console.log('Data values count:', dataValues.length);

        if (dataValues.length > 3000) {
            const step = Math.ceil(dataValues.length / 3000);
            dataValues = dataValues.filter((_, i) => i % step === 0);
        }

        let breaks = dataValues.length <= numClasses
            ? dataValues
            : getJenksBreaks(dataValues, numClasses);

        breaks = breaks.map(v => Math.round(v * 1000) / 1000);

        console.log('Breaks:', breaks);

    } catch (err) {
        console.error('Error during simulation:', err);
    } finally {
        await pool.end();
    }
}

simulateBreaksHandler();
