import XLSX from 'xlsx-js-style';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { layoutSettings, planPages, metrics, cellColor, newClass, uid, gender, validateProject } from './model.js';

const META = '__花名册数据';
const font = { name: '微软雅黑', sz: 13, color: { rgb: '273D48' } };
const baseStyle = { font, alignment: { vertical: 'center', horizontal: 'left', indent: 1 }, border: {} };
function textCell(value, style) { return { t: 's', v: String(value), s: style || baseStyle }; }
function sheetName(name, used) {
  let base = name.replace(/[\\/?*\[\]:]/g, '_').replace(/^'+|'+$/g, '').slice(0, 31) || '班级';
  if (base === META) base = '班级数据';
  let out = base, n = 2;
  while (used.has(out.toLowerCase())) { const suffix = ` (${n++})`; out = base.slice(0, 31 - suffix.length) + suffix; }
  used.add(out.toLowerCase()); return out;
}
export function exportWorkbook(project) {
  const wb = XLSX.utils.book_new(), used = new Set(), entries = [], breaks = [];
  for (const cls of project.classes) {
    const s = layoutSettings(cls), m = metrics(s), pages = planPages(cls);
    const ws = { '!merges': [], '!rows': [], '!cols': [{ wpx: m.columnWidth * 96 / 25.4 }, { wpx: s.gap * 96 / 25.4 }, { wpx: m.columnWidth * 96 / 25.4 }] };
    const mapping = []; const pageBreaks = []; let row = 0;
    const put = (r, c, v, style) => { const ref = XLSX.utils.encode_cell({ r, c }); ws[ref] = textCell(v, style); return ref; };
    const setHeight = (r, mm) => { ws['!rows'][r] = { hpt: mm * 72 / 25.4 }; };
    const member = (p, r, c, color) => {
      const prefix = s.showNumbers ? `${p.number}. ` : '';
      const ref = put(r, c, prefix + p.name, { ...baseStyle, font: { ...font, sz: s.fontSize }, fill: { patternType: 'solid', fgColor: { rgb: color } } });
      mapping.push({ ref, name: p.name, gender: p.gender, order: p.number, prefix });
    };
    for (let pi = 0; pi < pages.length; pi++) {
      if (pi) pageBreaks.push(row);
      put(row, 0, s.title || `${cls.name}花名册`, { font: { ...font, sz: 19, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } });
      ws['!merges'].push({ s: { r: row, c: 0 }, e: { r: row, c: 2 } }); setHeight(row++, 12);
      put(row, 0, `${cls.name} · 共 ${cls.students.length} 人 · 男 ${cls.students.filter(p => p.gender === '男').length} 人 / 女 ${cls.students.filter(p => p.gender === '女').length} 人 · 第 ${pi + 1}/${pages.length} 页`, { font: { ...font, sz: 9, color: { rgb: '7C8C96' } }, alignment: { horizontal: 'center', vertical: 'center' } });
      ws['!merges'].push({ s: { r: row, c: 0 }, e: { r: row, c: 2 } }); setHeight(row++, 8);
      const page = pages[pi];
      if (page.mode === 'gender') {
        const hs = { font: { ...font, sz: 11, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
        put(row, 0, '男生', hs); put(row, 2, '女生', hs); setHeight(row++, m.heading);
        for (let j = 0; j < Math.max(...page.columns.map(a => a.length)); j++) {
          page.columns.forEach((list, ci) => { if (list[j]) member(list[j], row, ci * 2, cellColor(s, ci)); }); setHeight(row++, m.row);
        }
      } else {
        page.pairs.forEach((pair, pairIndex) => {
          if (pairIndex) setHeight(row++, s.groupGap);
          pair.blocks.forEach((b, ci) => { if (b) put(row, ci * 2, `第 ${b.index + 1} 组${b.continued ? '（续）' : ''}`, { font: { ...font, sz: 11, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } }); });
          setHeight(row++, m.heading);
          const length = Math.max(...pair.blocks.map(b => b?.students.length || 0));
          for (let j = 0; j < length; j++) {
            pair.blocks.forEach((b, ci) => { if (b?.students[j]) member(b.students[j], row, ci * 2, cellColor(s, b.index, j + b.offset)); }); setHeight(row++, m.row);
          }
        });
      }
    }
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, row - 1), c: 2 } });
    ws['!margins'] = { left: s.margin / 25.4, right: s.margin / 25.4, top: s.verticalMargin / 25.4, bottom: s.verticalMargin / 25.4, header: 0, footer: 0 };
    const name = sheetName(cls.name, used); XLSX.utils.book_append_sheet(wb, ws, name);
    entries.push({ sheet: name, classId: cls.id, mapping }); breaks.push(pageBreaks);
  }
  const payload = JSON.stringify({ format: 'class-roster-excel', version: 1, project, entries });
  const chunks = payload.match(/[\s\S]{1,16000}/g) || [];
  const meta = XLSX.utils.aoa_to_sheet([['class-roster-excel-v1'], ...chunks.map(v => [v])]);
  XLSX.utils.book_append_sheet(wb, meta, META);
  wb.Workbook = { Sheets: wb.SheetNames.map(name => ({ name, Hidden: name === META ? 1 : 0 })) };
  // Explicitly set A4 and manual page breaks in OOXML (not emitted by the style library).
  const zip = unzipSync(new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx', bookSST: true })));
  breaks.forEach((rows, i) => {
    const path = `xl/worksheets/sheet${i + 1}.xml`; let xml = strFromU8(zip[path]);
    xml = xml.replace(/<pageSetup\b[^>]*\/>/g, '').replace(/<rowBreaks[\s\S]*?<\/rowBreaks>/g, '');
    const setup = '<pageSetup paperSize="9" orientation="portrait" scale="100" useFirstPageNumber="0"/>';
    const rb = rows.length ? `<rowBreaks count="${rows.length}" manualBreakCount="${rows.length}">${rows.map(id => `<brk id="${id}" max="16383" man="1"/>`).join('')}</rowBreaks>` : '';
    xml = xml.replace('</worksheet>', `${setup}${rb}</worksheet>`); zip[path] = strToU8(xml);
  });
  return zipSync(zip, { level: 6 });
}

function cellText(sheet, ref) { return String(sheet?.[ref]?.v ?? '').trim(); }
export function importWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' });
  if (wb.Sheets[META]?.A1?.v === 'class-roster-excel-v1') {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[META], { header: 1, raw: true });
    let payload;
    try { payload = JSON.parse(rows.slice(1).map(r => r[0] || '').join('')); } catch { throw new Error('Excel 内的花名册存档已损坏。'); }
    if (payload.format !== 'class-roster-excel' || payload.version !== 1 || !Array.isArray(payload.entries)) throw new Error('Excel 存档格式不受支持。');
    const project = validateProject(payload.project), warnings = []; let changes = 0;
    for (const cls of project.classes) {
      const entry = payload.entries.find(e => e.classId === cls.id);
      if (!entry || !Array.isArray(entry.mapping) || !wb.Sheets[entry.sheet]) throw new Error(`找不到班级「${cls.name}」的展示工作表，无法安全恢复。`);
      const sheet = wb.Sheets[entry.sheet]; const students = [];
      entry.mapping.slice().sort((a, b) => a.order - b.order).forEach(item => {
        let name = cellText(sheet, item.ref);
        const original = `${item.prefix}${item.name}`;
        if (name !== original) changes++;
        if (!name) return; // A cleared mapped name is treated as deletion.
        if (item.prefix && name.startsWith(item.prefix)) name = name.slice(item.prefix.length).trim();
        else if (item.prefix) name = name.replace(/^\d+[.、．]\s*/, '').trim();
        if (!name || name.length > 80) throw new Error(`工作表「${entry.sheet}」${item.ref} 的姓名无效。`);
        const g = gender(item.gender); if (!g) throw new Error('Excel 存档中的性别无效。');
        students.push({ id: uid(), name, gender: g });
      });
      cls.students = students;
      // Warn on added untracked cells, rather than silently claiming a complete recovery.
      const known = new Set(entry.mapping.map(m => m.ref));
      const untracked = Object.keys(sheet).filter(ref => !ref.startsWith('!') && !known.has(ref) && cellText(sheet, ref) && !/^([A-Z]+)(1|2)$/.test(ref));
      if (untracked.length) warnings.push(`「${entry.sheet}」：展示表的新增行、插入/移动行及性别调整不自动恢复；请在应用内编辑。支持原位置改名、清空姓名。`);
    }
    return { project, warnings: [...new Set(warnings)], changes, source: 'archive' };
  }
  const classes = [], warnings = [];
  for (const name of wb.SheetNames) {
    if (name === META) continue;
    const data = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
    let start = 0, ni = 0, gi = 1;
    const head = data.findIndex(r => r.some(v => ['姓名', '学生姓名', '名字'].includes(String(v).trim())) && r.some(v => String(v).trim() === '性别'));
    if (head >= 0) { start = head + 1; ni = data[head].findIndex(v => ['姓名', '学生姓名', '名字'].includes(String(v).trim())); gi = data[head].findIndex(v => String(v).trim() === '性别'); }
    const cls = newClass(name);
    data.slice(start).forEach((r, j) => {
      if (!r.some(v => String(v).trim())) return;
      const n = String(r[ni] ?? '').trim(), g = gender(r[gi]);
      if (!n || n.length > 80 || !g) { warnings.push(`「${name}」第 ${start + j + 1} 行：姓名或性别无效，已跳过。`); return; }
      cls.students.push({ id: uid(), name: n, gender: g });
    });
    if (cls.students.length) classes.push(cls);
  }
  if (!classes.length) throw new Error('未找到有效名单。普通 Excel 请使用“姓名、性别”两列，每个班级一个工作表。');
  return { project: validateProject({ format: 'class-roster', version: 1, classes, activeId: classes[0].id }), warnings, changes: 0, source: 'plain' };
}
