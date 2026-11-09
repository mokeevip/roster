export const defaults = Object.freeze({ title: '', mode: 'gender', groupSize: 5, palette: 'fresh', fontSize: 13, rowHeight: 9, margin: 15, gap: 15, verticalMargin: 15, groupGap: 5, showNumbers: true, autoFit: false });
export const palettes = {
  fresh: ['D9EAF5', 'F4DEE7', 'DCEEDC', 'F9E8CD', 'E8E0F3', 'D8EEEA'],
  warm: ['F7DFCD', 'E8DFF3', 'FAECCB', 'DDE9D5', 'D9E8F2', 'F4DCE0'],
  ocean: ['BEDDF2', 'C8E9F0', 'CCDAF2', 'BFE5E8', 'D7E7F5', 'CADFED'],
  forest: ['CCE4CC', 'DDE8C5', 'BFE2D5', 'D3E9DB', 'DBE5CE', 'C5DED8'],
  sunset: ['F5D3BA', 'F3C9C7', 'F6DFBA', 'EBCDD8', 'F4DCCB', 'F0D7B8'],
  lavender: ['DBCEF0', 'E9D3ED', 'CFD6F0', 'E3DDF4', 'D6CBE6', 'EBDCF0'],
  sakura: ['F2CDD9', 'F5D9E4', 'EBCDE3', 'F4D5CE', 'E9D8ED', 'F3DFE5'],
  mint: ['C5E8DE', 'D3EEDB', 'C9E8EA', 'DDEFCF', 'CDE3D8', 'D8EFEB'],
  earth: ['E4D6BF', 'D5DDC7', 'E9CFBE', 'DAD3C5', 'E8DFC9', 'D0DED4'],
  rainbow: ['F1CCCC', 'F4DABD', 'EEE6BF', 'CDE5CC', 'C9DEF1', 'DDCEED'],
  gray: ['E3E7EB', 'D5DBE0', 'ECEEF0', 'CDD5DC']
};
export const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const newClass = (name = '新班级') => ({ id: uid(), name, students: [], settings: { ...defaults } });
export const newProject = () => { const c = newClass('我的班级'); return { format: 'class-roster', version: 1, activeId: c.id, classes: [c], templates: [] }; };
export function gender(value) {
  const s = String(value ?? '').trim().toLowerCase();
  if (['男', '男生', '男性', 'm', 'male'].includes(s)) return '男';
  if (['女', '女生', '女性', 'f', 'female'].includes(s)) return '女';
  return '';
}
export function cleanSettings(s = {}) {
  const result = { ...defaults };
  result.title = String(s.title ?? '').slice(0, 100);
  result.mode = s.mode === 'group' ? 'group' : 'gender';
  result.palette = palettes[s.palette] ? s.palette : 'fresh';
  for (const [key, min, max, integer] of [['groupSize', 1, 100, true], ['fontSize', 9, 24, true], ['rowHeight', 3.4, 18], ['margin', 8, 30], ['gap', 8, 35], ['verticalMargin', 8, 25], ['groupGap', 2, 12]]) {
    const n = Number(s[key] ?? defaults[key]);
    result[key] = Number.isFinite(n) ? Math.min(max, Math.max(min, integer ? Math.round(n) : n)) : defaults[key];
  }
  result.showNumbers = s.showNumbers !== false;
  result.autoFit = s.autoFit === true;
  for (const [key, min, max] of [['layoutRow', 4, 19], ['layoutHeading', 4, 10]]) {
    if (Number.isFinite(s[key])) result[key] = Math.min(max, Math.max(min, s[key]));
  }
  return result;
}
export function validateProject(data) {
  if (!data || data.format !== 'class-roster' || data.version !== 1 || !Array.isArray(data.classes) || !data.classes.length) throw new Error('不是有效的花名册项目文件，或文件版本不受支持。');
  if (data.classes.length > 200) throw new Error('一次最多支持 200 个班级。');
  const seen = new Set();
  const classes = data.classes.map((c, i) => {
    if (!c || !Array.isArray(c.students) || c.students.length > 10000) throw new Error(`第 ${i + 1} 个班级的名单无效或超过 10000 人。`);
    const id = typeof c.id === 'string' && !seen.has(c.id) ? c.id : uid(); seen.add(id);
    return { id, name: String(c.name || `班级 ${i + 1}`).slice(0, 80), settings: cleanSettings(c.settings), students: c.students.map((p, j) => {
      const name = String(p?.name ?? '').trim(); const g = gender(p?.gender);
      if (!name || name.length > 80 || !g) throw new Error(`班级「${c.name}」第 ${j + 1} 位学生姓名或性别无效。`);
      return { id: uid(), name, gender: g };
    }) };
  });
  if (data.templates !== undefined && (!Array.isArray(data.templates) || data.templates.length > 200)) throw new Error('排版模板无效或超过 200 个。');
  const templateIds = new Set();
  const templates = (data.templates || []).map(t => {
    if (!t || typeof t.name !== 'string' || !t.name.trim()) throw new Error('排版模板名称无效。');
    const id = typeof t.id === 'string' && !templateIds.has(t.id) ? t.id : uid(); templateIds.add(id);
    return { id, name: t.name.trim().slice(0, 80), settings: cleanSettings(t.settings) };
  });
  return { format: 'class-roster', version: 1, classes, templates, activeId: classes.some(c => c.id === data.activeId) ? data.activeId : classes[0].id };
}
export function parseText(text) {
  const rows = []; const errors = [];
  text.replace(/^\uFEFF/, '').split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const parts = line.trim().split(/[\t,，;；]+|\s+/).map(s => s.trim());
    if (['姓名', '名字', '学生姓名'].includes(parts[0]) && ['性别', '男女'].includes(parts[1])) return;
    const name = parts[0], g = gender(parts[1]);
    if (parts.length !== 2 || !name || name.length > 80 || !g) { errors.push(`第 ${i + 1} 行：请提供姓名与有效性别两列 → ${line}`); return; }
    rows.push({ id: uid(), name, gender: g });
  });
  return { rows, errors };
}
export function duplicateNames(students) {
  const counts = new Map(); students.forEach(s => counts.set(s.name, (counts.get(s.name) || 0) + 1));
  return [...counts].filter(([, count]) => count > 1).map(([name, count]) => `${name}（${count}人）`);
}
// Heights are in millimetres and shared by screen, print and Excel layouts.
export function metrics(settings) {
  const s = cleanSettings(settings);
  const row = Math.max(settings.layoutRow ?? s.rowHeight + 0.6, s.fontSize * 25.4 / 72 * 1.28 + 0.6);
  const heading = settings.layoutHeading ?? (s.mode === 'gender' ? 10 : 8);
  const body = 297 - s.verticalMargin * 2 - 20;
  return { row, heading, body, genderCapacity: Math.max(1, Math.floor((body - heading) / row)), groupCapacity: Math.max(1, Math.floor((body - heading) / row)), columnWidth: (210 - 2 * s.margin - s.gap) / 2 };
}
// Transient dimensions: never overwrite the user's saved manual settings.
export function layoutSettings(cls) {
  const s = cleanSettings(cls.settings), original = metrics(s);
  if (!s.autoFit || !cls.students.length) return s;
  let rows = 0, pairs = 1;
  if (s.mode === 'gender') {
    const male = cls.students.filter(p => p.gender === '男').length;
    rows = Math.max(male, cls.students.length - male);
  } else {
    const groups = Math.ceil(cls.students.length / s.groupSize);
    pairs = Math.ceil(groups / 2);
    for (let i = 0; i < groups; i += 2) rows += Math.min(s.groupSize, cls.students.length - i * s.groupSize);
  }
  const availableRow = () => (metrics(s).body - pairs * (s.layoutHeading ?? original.heading) - (pairs - 1) * s.groupGap) / rows;
  if (availableRow() >= original.row) return s;
  // Reduce row whitespace first, then headings/gaps, margins, and finally font size.
  const minRow = () => s.fontSize * 25.4 / 72 * 1.28 + 0.6;
  if (availableRow() < minRow()) {
    s.layoutHeading = 4;
    if (s.mode === 'group') s.groupGap = Math.min(s.groupGap, 2);
  }
  if (availableRow() < minRow()) s.verticalMargin = 8;
  if (availableRow() < minRow()) s.fontSize = Math.max(9, Math.min(s.fontSize, Math.floor((availableRow() - 0.6) * 72 / 25.4 / 1.28)));
  s.layoutRow = Math.max(minRow(), Math.min(original.row, availableRow() - 0.001));
  return s;
}
export function planPages(cls) {
  const s = layoutSettings(cls), m = metrics(s);
  const members = cls.students.map((p, i) => ({ ...p, number: i + 1 }));
  if (s.mode === 'gender') {
    const male = members.filter(p => p.gender === '男'), female = members.filter(p => p.gender === '女');
    const total = Math.max(1, Math.ceil(Math.max(male.length, female.length) / m.genderCapacity));
    return Array.from({ length: total }, (_, i) => ({ columns: [male.slice(i * m.genderCapacity, (i + 1) * m.genderCapacity), female.slice(i * m.genderCapacity, (i + 1) * m.genderCapacity)], mode: 'gender' }));
  }
  // Place pairs of complete groups left-to-right; oversized groups continue on following pairs.
  const blocks = [];
  for (let i = 0; i < members.length; i += s.groupSize) {
    const group = members.slice(i, i + s.groupSize), index = Math.floor(i / s.groupSize);
    for (let offset = 0; offset < group.length; offset += m.groupCapacity) {
      const students = group.slice(offset, offset + m.groupCapacity);
      blocks.push({ index, continued: offset > 0, students, offset, groupLength: group.length, height: m.heading + students.length * m.row });
    }
  }
  const pages = []; let page = { mode: 'group', pairs: [] }, used = 0;
  for (let i = 0; i < blocks.length; i += 2) {
    const pair = [blocks[i], blocks[i + 1] || null], height = Math.max(...pair.map(b => b?.height || 0));
    const gap = page.pairs.length ? s.groupGap : 0;
    if (used + gap + height > m.body + 0.001 && page.pairs.length) { pages.push(page); page = { mode: 'group', pairs: [] }; used = 0; }
    used += (page.pairs.length ? s.groupGap : 0) + height;
    page.pairs.push({ blocks: pair, height });
  }
  if (page.pairs.length || !pages.length) pages.push(page);
  return pages;
}
export function cellColor(settings, index, offset = 0, groupLength = settings.groupSize) {
  const list = palettes[settings.palette] || palettes.fresh;
  if (settings.mode !== 'group') return list[index % list.length];
  const [r, g, b] = list[0].match(/../g).map(v => parseInt(v, 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const seed = !delta ? 0 : max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  // Golden-angle spacing gives each group its own hue without a short palette cycle.
  // Keep that hue and saturation fixed within the group; only lightness changes.
  const hue = (seed * 60 + index * 137.507764) % 360;
  const saturation = settings.palette === 'gray' ? 0 : Math.min(0.65, Math.max(0.35, delta / (1 - Math.abs(max + min - 1))));
  const progress = groupLength > 1 ? Math.min(1, Math.max(0, offset / (groupLength - 1))) : 0.5;
  const lightness = settings.palette === 'gray'
    ? 0.62 + ((index * 0.618033989) % 1) * 0.12 + progress * 0.2
    : 0.7 + progress * 0.25;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1)), m = lightness - chroma / 2;
  const channels = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return channels.map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}
