export function translateTop(sql) {
  const trimmed = String(sql).trim().replace(/;+\s*$/, '');
  const match = trimmed.match(/^(\s*SELECT\s+)(DISTINCT\s+)?TOP\s+(\d+)\s+/i);
  return match ? `${match[1]}${match[2] || ''}${trimmed.slice(match[0].length)} LIMIT ${Number(match[3])}` : trimmed;
}
