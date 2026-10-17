export const DEFAULT_PALETTE = ['#FF4F84', '#FFDE00', '#7E69FF', '#38E05A', '#FFA25B', '#45B7D1'];
const hex = value => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
const safeJSON = value => JSON.stringify(value).replace(/</g, '\u003c').replace(/>/g, '\u003e').replace(/&/g, '\u0026');

export function colorGraphHTML(html, config = {}) {
  const palette = config.palette ?? DEFAULT_PALETTE;
  const overrides = config.groupColors ?? {};
  if (!Array.isArray(palette) || !palette.length || !palette.every(hex) || !overrides || typeof overrides !== 'object' || Array.isArray(overrides) || !Object.values(overrides).every(hex)) {
    throw Object.assign(new Error('Invalid graphify-colors.json. Use a nonempty palette and #RRGGBB colour values.'), { status: 503 });
  }
  const match = html.match(/^const RAW_NODES = (.+);\r?$/m);
  if (!match) return html;
  const nodes = JSON.parse(match[1]);
  const ids = [...new Set(nodes.map(n => String(n.community ?? 0)))].sort((a,b) => a.localeCompare(b, undefined, {numeric:true}));
  const colors = new Map(ids.map((id,i) => [id, overrides[id] ?? palette[i % palette.length]]));
  for (const node of nodes) {
    const color = colors.get(String(node.community ?? 0));
    node.color = { ...node.color, background: color, border: color, highlight: {background: '#FFFFFF', border: color}, hover: {background: color, border: '#FFFFFF'} };
  }
  let result = html.replace(match[0], 'const RAW_NODES = '+safeJSON(nodes)+';');
  const legendMatch = result.match(/^const LEGEND = (.+);\r?$/m);
  if (legendMatch) {
    let legend = JSON.parse(legendMatch[1]);
    if (!legend.length) legend = ids.map(id => {
      const members = nodes.filter(n => String(n.community ?? 0) === id);
      return {cid: members[0].community ?? 0, label: members[0].community_name || 'Community '+id, count: members.length};
    });
    legend = legend.map(entry => ({ ...entry, color: colors.get(String(entry.cid)) || entry.color }));
    result = result.replace(legendMatch[0], 'const LEGEND = '+safeJSON(legend)+';');
  }
  return result;
}
