/**
 * build_knowledge_graph.js
 *
 * Build server/mcp/knowledge_base.json from ontology + DB metadata.
 * Output encoding is UTF-8.
 */

import pool from '../../server/config/db.js';
import fs from 'fs/promises';
import path from 'path';

const ONTOLOGY_PATH = path.resolve('server/mcp/ontology.json');
const KB_PATH = path.resolve('server/mcp/knowledge_base.json');

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function decodePeriodToken(token) {
  // token like y8590_11 / y2021_11 / y9900_11
  const m = String(token || '').match(/^y(\d{2}|\d{4})(\d{2}|\d{4})_/i);
  if (!m) return null;

  const [_, a, b] = m;
  const toYear = (x) => {
    if (x.length === 4) return Number(x);
    const n = Number(x);
    // CLCD years are modern; use 85->1985, 09->2009, etc.
    return n >= 80 ? 1900 + n : 2000 + n;
  };

  const y1 = toYear(a);
  const y2 = toYear(b);
  if (!Number.isFinite(y1) || !Number.isFinite(y2)) return null;
  return `${Math.min(y1, y2)}->${Math.max(y1, y2)}`;
}

async function getTransferPeriods() {
  const sql = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'spatial_county_yunnan_transfer'
      AND column_name ~ '^y[0-9]{4}_[0-9]{2}$'
    ORDER BY column_name
  `;
  const res = await pool.query(sql);
  const periods = res.rows
    .map(r => decodePeriodToken(r.column_name))
    .filter(Boolean);
  return uniqueSorted(periods);
}

async function main() {
  console.log('[KB] Building knowledge base...');

  try {
    const ontology = JSON.parse(await fs.readFile(ONTOLOGY_PATH, 'utf8'));
    const kb = {
      generated_at: new Date().toISOString(),
      ontology_version: ontology.version,
      summary: {
        tables: {}
      },
      entities: {
        regions: [],
        years: [],
        transfer_periods: []
      }
    };

    // 1) years
    const yearRes = await pool.query('SELECT DISTINCT year FROM public.clcd_province ORDER BY year');
    kb.entities.years = yearRes.rows.map(r => Number(r.year)).filter(Number.isFinite);

    // 2) prefecture regions
    const regionRes = await pool.query('SELECT DISTINCT region_name FROM public.clcd_prefecture ORDER BY region_name');
    kb.entities.regions = regionRes.rows.map(r => r.region_name).filter(Boolean);

    // 3) table summary
    const staticTables = Object.keys(ontology.database_mapping?.static_tables || {});
    const spatialTables = Object.keys(ontology.database_mapping?.spatial_tables || {});
    for (const table of [...staticTables, ...spatialTables]) {
      try {
        const countRes = await pool.query(`SELECT count(*) AS total FROM public."${table}"`);
        kb.summary.tables[table] = {
          rowCount: Number(countRes.rows[0]?.total || 0),
          description:
            ontology.database_mapping?.static_tables?.[table]?.desc ||
            ontology.database_mapping?.spatial_tables?.[table]?.desc ||
            ''
        };
      } catch (e) {
        console.warn(`[KB] skip table ${table}: ${e.message}`);
      }
    }

    // 4) transfer periods
    try {
      kb.entities.transfer_periods = await getTransferPeriods();
    } catch (e) {
      console.warn(`[KB] failed to extract transfer periods: ${e.message}`);
      kb.entities.transfer_periods = [];
    }

    await fs.writeFile(KB_PATH, JSON.stringify(kb, null, 2), 'utf8');
    console.log(`[KB] done -> ${KB_PATH}`);
  } catch (err) {
    console.error('[KB] failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();

