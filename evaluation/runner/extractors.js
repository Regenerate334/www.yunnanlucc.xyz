export function getByPath(obj, dottedPath) {
  if (!dottedPath) return obj;
  return String(dottedPath)
    .split('.')
    .reduce((current, key) => {
      if (current == null) return undefined;
      if (/^\d+$/.test(key)) return current[Number(key)];
      return current[key];
    }, obj);
}

const LAND_FIELDS = {
  cropland: '耕地',
  forest: '林地',
  shrub: '灌木',
  grassland: '草地',
  water: '水体',
  wetland: '湿地',
  impervious: '建设用地',
  barren: '裸地',
  snow_ice: '冰雪'
};

function numericValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function extractBaselineValue(structuredContent, extract = {}) {
  const rawValue = getByPath(structuredContent, extract.path);

  if (extract.type === 'numeric') {
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : null;
  }

  if (extract.type === 'trend') {
    const rows = Array.isArray(rawValue) ? rawValue : [];
    const field = extract.field;
    const first = rows[0];
    const last = rows[rows.length - 1];
    if (!first || !last || !field) return null;
    const start = Number(first[field] || 0);
    const end = Number(last[field] || 0);
    return {
      start_year: first.year,
      end_year: last.year,
      start_value: start,
      end_value: end,
      delta: end - start,
      direction: end > start ? 'increase' : end < start ? 'decrease' : 'stable'
    };
  }

  if (extract.type === 'top_transitions') {
    const rows = Array.isArray(rawValue) ? rawValue : [];
    return rows
      .filter((row) => Number(row.area || 0) > 0 && row.from_class !== row.to_class)
      .sort((a, b) => Number(b.area || 0) - Number(a.area || 0))
      .slice(0, extract.k || 5)
      .map((row) => ({
        from_class: row.from_class,
        to_class: row.to_class,
        key: `${row.from_class}->${row.to_class}`,
        area: Number(row.area || 0)
      }));
  }

  if (extract.type === 'top_regions') {
    const rows = Array.isArray(rawValue) ? rawValue : [];
    const key = extract.key || 'name';
    return rows.slice(0, extract.k || 5).map((row) => ({
      key: row[key],
      name: row.name,
      value: row.transfer_area_km2
    }));
  }

  if (extract.type === 'top_regions_by_field') {
    const rows = Array.isArray(rawValue) ? rawValue : [];
    const field = extract.field;
    const key = extract.key || 'region_name';
    return rows
      .map((row) => ({
        key: row[key] || row.name || row.region_name,
        name: row[key] || row.name || row.region_name,
        value: numericValue(row[field])
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, extract.k || rows.length);
  }

  if (extract.type === 'dominant_land_types') {
    const row = rawValue || {};
    return Object.entries(LAND_FIELDS)
      .map(([field, name]) => ({
        key: field,
        name,
        value: numericValue(row[field])
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, extract.k || 3);
  }

  if (extract.type === 'sde_last_numeric') {
    const rows = Array.isArray(rawValue) ? rawValue : [];
    const validRows = rows.filter(Boolean);
    const last = validRows[validRows.length - 1];
    const value = Number(last?.[extract.field]);
    return Number.isFinite(value) ? value : null;
  }

  if (extract.type === 'fact_units') {
    const rows = Array.isArray(rawValue) ? rawValue : [];
    const key = extract.key || 'summary';
    return rows.map((row) => row[key]).filter(Boolean);
  }

  return rawValue ?? null;
}
