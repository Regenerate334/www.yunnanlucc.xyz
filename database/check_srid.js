import pool from '../../server/config/db.js';
try {
    const r1 = await pool.query(`SELECT Find_SRID('public','spatial_county_yunnan_transfer','geom') as srid`);
    console.log('County transfer SRID:', r1.rows[0].srid);
    const r2 = await pool.query(`SELECT Find_SRID('public','spatial_county_yunnan_stats','geom') as srid`);
    console.log('County stats SRID:', r2.rows[0].srid);
    const r3 = await pool.query(`SELECT ST_Extent(geom) as extent FROM public."spatial_county_yunnan_transfer"`);
    console.log('County transfer extent (native):', r3.rows[0].extent);
} catch (e) { console.error(e.message); }
await pool.end();
