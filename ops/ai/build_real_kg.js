/**
 * build_real_kg.js
 *
 * Build a connected semantic graph for MCP knowledge_query:
 * - nodes: Region / LandUseType / Indicator / Policy / Condition / TransferPeriod
 * - links: located_in / adjacent_to / contributes_to / impacts_at / mapped_to_condition / transfers_path
 */

import pool from '../../server/config/db.js';
import fs from 'fs/promises';
import path from 'path';

const ONTOLOGY_PATH = path.resolve('server/mcp/ontology.json');
const KG_PATH = path.resolve('server/mcp/knowledge_graph.json');

function slug(s) {
  return String(s || '').trim().replace(/\s+/g, '_');
}

function decodePeriodToken(token) {
  const m = String(token || '').match(/^y(\d{2}|\d{4})(\d{2}|\d{4})_/i);
  if (!m) return null;
  const [_, a, b] = m;
  const toYear = (x) => {
    if (x.length === 4) return Number(x);
    const n = Number(x);
    return n >= 80 ? 1900 + n : 2000 + n;
  };
  const y1 = toYear(a);
  const y2 = toYear(b);
  if (!Number.isFinite(y1) || !Number.isFinite(y2)) return null;
  return `${Math.min(y1, y2)}->${Math.max(y1, y2)}`;
}

function parseTransferCodeColumn(col) {
  // y8590_17 => period:1985->1990 from:1 to:7
  const m = String(col || '').match(/^y(\d{2}|\d{4})(\d{2}|\d{4})_(\d)(\d)$/i);
  if (!m) return null;
  const period = decodePeriodToken(`y${m[1]}${m[2]}_00`);
  if (!period) return null;
  return { period, fromCode: Number(m[3]), toCode: Number(m[4]) };
}

function quantile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

async function extractCountyPrefectureMap() {
  const sql = `
    SELECT DISTINCT "地名" AS county_name, "地级" AS prefecture_name
    FROM public.spatial_county_yunnan_stats
    WHERE "地名" IS NOT NULL AND "地级" IS NOT NULL
  `;
  const res = await pool.query(sql);
  const map = new Map();
  for (const row of res.rows) {
    const c = row.county_name;
    const p = row.prefecture_name;
    if (c && p && !map.has(c)) map.set(c, p);
  }
  return map;
}

async function extractRegionAdjacency() {
  // County adjacency based on geometry touch. Restrict to modest result size.
  const sql = `
    SELECT a."地名" AS county_a, b."地名" AS county_b
    FROM public.spatial_county_yunnan_stats a
    JOIN public.spatial_county_yunnan_stats b
      ON a.gid < b.gid
     AND ST_Touches(a.geom, b.geom)
    WHERE a."地名" IS NOT NULL
      AND b."地名" IS NOT NULL
    LIMIT 6000
  `;
  const res = await pool.query(sql);
  return res.rows
    .map(r => [r.county_a, r.county_b])
    .filter(([a, b]) => a && b);
}

async function extractTransferColumns() {
  const sql = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='spatial_county_yunnan_transfer'
      AND column_name ~ '^y[0-9]{4}_[0-9]{2}$'
    ORDER BY column_name
  `;
  const res = await pool.query(sql);
  return res.rows.map(r => r.column_name);
}

async function extractTransferStrength(cols) {
  if (!cols.length) return new Map();
  const selects = cols.map(c => `COALESCE(SUM("${c}"),0) AS "${c}"`).join(', ');
  const sql = `SELECT ${selects} FROM public.spatial_county_yunnan_transfer`;
  const res = await pool.query(sql);
  const row = res.rows[0] || {};
  const values = cols.map(c => Number(row[c] || 0)).filter(Number.isFinite).sort((a, b) => a - b);
  const q50 = quantile(values, 0.5);
  const q80 = quantile(values, 0.8);
  const q95 = quantile(values, 0.95);

  const strength = new Map();
  for (const c of cols) {
    const v = Number(row[c] || 0);
    let level = 'low';
    if (v >= q95) level = 'very_high';
    else if (v >= q80) level = 'high';
    else if (v >= q50) level = 'medium';
    strength.set(c, { total: v, level });
  }
  return strength;
}

async function main() {
  console.log('[KG] Building connected graph...');

  try {
    const ontology = JSON.parse(await fs.readFile(ONTOLOGY_PATH, 'utf8'));

    const kg = {
      metadata: {
        generated_at: new Date().toISOString(),
        version: '11.0.0',
        description: 'Connected semantic KG with ontology-aligned relations'
      },
      nodes: [],
      links: []
    };

    const nodeMap = new Map();
    const linkSet = new Set();

    const addNode = (id, label, type, props = {}) => {
      if (!id) return;
      const current = nodeMap.get(id) || { id, label: label || id, type };
      nodeMap.set(id, { ...current, ...props, id, label: label || current.label, type: type || current.type });
    };

    const addLink = (source, target, relation, props = {}) => {
      if (!source || !target || !relation) return;
      const key = `${source}|${relation}|${target}`;
      if (linkSet.has(key)) return;
      linkSet.add(key);
      kg.links.push({ source, target, relation, ...props });
    };

    // Region nodes
    addNode('region:yunnan', '云南省', 'Region', { level: 'province', alias: ['云南', 'yunnan'] });

    const county2pref = await extractCountyPrefectureMap();
    const prefectureNames = [...new Set([...county2pref.values()])].sort();

    for (const name of prefectureNames) {
      const id = `region:pref:${slug(name)}`;
      addNode(id, name, 'Region', { level: 'prefecture', alias: [name] });
      addLink(id, 'region:yunnan', 'located_in');
    }

    for (const [name, pref] of county2pref.entries()) {
      const id = `region:county:${slug(name)}`;
      addNode(id, name, 'Region', { level: 'county', alias: [name] });
      addLink(id, `region:pref:${slug(pref)}`, 'located_in');
    }

    // Region adjacency (county)
    const adjacency = await extractRegionAdjacency();
    for (const [a, b] of adjacency) {
      const aId = `region:county:${slug(a)}`;
      const bId = `region:county:${slug(b)}`;
      addLink(aId, bId, 'adjacent_to');
      addLink(bId, aId, 'adjacent_to', { is_inverse: true });
    }

    // LandUseType + Indicator
    const lu = ontology.entities?.LandUseType?.categories || {};
    const indicators = ontology.entities?.MonitoringIndex?.definitions || {};

    for (const [k, v] of Object.entries(lu)) {
      addNode(`land:${k}`, v.cn || k, 'LandUseType', {
        ...v,
        alias: [k, v.cn].filter(Boolean),
        action_template: { query_type: 'structure', region: '$REGION', year: '$YEAR', land_type: k }
      });
    }

    for (const [k, v] of Object.entries(indicators)) {
      addNode(`indicator:${k}`, v.full_name || k, 'Indicator', {
        ...v,
        alias: [k, v.full_name].filter(Boolean),
        action_template: { query_type: 'monitoring', region: '$REGION', year: '$YEAR' }
      });
    }

    // contributes_to links by configured weights
    for (const [k, v] of Object.entries(lu)) {
      if (typeof v.hqi_weight === 'number') {
        addLink(`land:${k}`, 'indicator:HQI', 'contributes_to', { weight: v.hqi_weight });
      }
      if (typeof v.eres_weight === 'number') {
        addLink(`land:${k}`, 'indicator:ERes', 'contributes_to', { weight: v.eres_weight });
      }
    }

    // Policy nodes + impacts_at
    const policies = ontology.entities?.Policy?.milestones || {};
    for (const [k, v] of Object.entries(policies)) {
      const pid = `policy:${k}`;
      addNode(pid, v.name || k, 'Policy', {
        ...v,
        alias: [k, v.name].filter(Boolean),
        action_template: { query_type: 'comparison', region: '$REGION', year_range: [v.start_year, '$YEAR'] }
      });
      addLink(pid, 'region:yunnan', 'impacts_at', { start_year: v.start_year, impact: v.impact || '' });
    }

    // Condition nodes + mapped_to_condition
    const cond = ontology.entities?.Condition?.levels || {};
    for (const [k, v] of Object.entries(cond)) {
      const cid = `condition:${k}`;
      addNode(cid, v.label || k, 'Condition', { ...v, alias: [k, v.label].filter(Boolean) });
      for (const ik of Object.keys(indicators)) {
        addLink(`indicator:${ik}`, cid, 'mapped_to_condition', { range: v.range || [] });
      }
    }

    // Transfer period + transfers_path
    const transferCols = await extractTransferColumns();
    const transferStrength = await extractTransferStrength(transferCols);
    const periodSeen = new Set();
    for (const col of transferCols) {
      const parsed = parseTransferCodeColumn(col);
      if (!parsed) continue;
      const { period, fromCode, toCode } = parsed;

      const periodId = `period:${period}`;
      if (!periodSeen.has(periodId)) {
        periodSeen.add(periodId);
        addNode(periodId, period, 'TransferPeriod', { alias: [period] });
      }

      const fromKey = Object.keys(lu)[fromCode - 1];
      const toKey = Object.keys(lu)[toCode - 1];
      if (!fromKey || !toKey) continue;
      if (fromKey === toKey) continue;

      const st = transferStrength.get(col) || { total: 0, level: 'low' };
      addLink(`land:${fromKey}`, `land:${toKey}`, 'transfers_path', {
        period,
        period_node: periodId,
        transfer_column: col,
        total_area: st.total,
        strength: st.level
      });
      addLink(`land:${fromKey}`, periodId, 'transfers_path', { role: 'from' });
      addLink(periodId, `land:${toKey}`, 'transfers_path', { role: 'to', strength: st.level });
    }

    // finalize nodes
    kg.nodes = [...nodeMap.values()];
    await fs.writeFile(KG_PATH, JSON.stringify(kg, null, 2), 'utf8');

    console.log(`[KG] done -> ${KG_PATH}`);
    console.log(`[KG] nodes=${kg.nodes.length}, links=${kg.links.length}`);
  } catch (err) {
    console.error('[KG] failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
