import test from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx-js-style';
import { unzipSync, strFromU8 } from 'fflate';
import { newClass, planPages, metrics, parseText, validateProject, layoutSettings } from '../src/model.js';
import { exportWorkbook, importWorkbook } from '../src/excel.js';

function fixture(count = 61) {
  const c = newClass('一年一班');
  c.students = Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `学生${i + 1}`, gender: i % 3 ? '男' : '女' }));
  return { format: 'class-roster', version: 1, activeId: c.id, classes: [c] };
}
test('粘贴解析不丢失无效行，并允许同名', () => {
  const r = parseText('姓名\t性别\r\n小明\t男\n小明 女\n小红 未知');
  assert.equal(r.rows.length, 2); assert.equal(r.errors.length, 1);
});
test('男女不均时分页且保持原始编号，左右尺寸对称', () => {
  const p = fixture(111), c = p.classes[0]; c.settings.autoFit = false;
  const pages = planPages(c), m = metrics(c.settings);
  assert.ok(pages.length > 1);
  assert.equal(m.columnWidth * 2 + c.settings.gap + c.settings.margin * 2, 210);
  for (const [ci, g] of [[0, '男'], [1, '女']]) {
    assert.deepEqual(pages.flatMap(page => page.columns[ci]).map(s => s.name), c.students.filter(s => s.gender === g).map(s => s.name));
    assert.ok(pages.every(page => page.columns[ci].length <= m.genderCapacity));
  }
});
test('整组不跨页，超长组续页，所有成员不重复不丢失', () => {
  for (const groupSize of [1, 5, 17, 100]) {
    const c = fixture(257).classes[0]; Object.assign(c.settings, { mode: 'group', groupSize, fontSize: 24, rowHeight: 7, autoFit: false });
    const pages = planPages(c), m = metrics(c.settings);
    const blocks = pages.flatMap(p => p.pairs.flatMap(pair => pair.blocks.filter(Boolean)));
    assert.deepEqual(blocks.flatMap(b => b.students.map(s => s.number)), c.students.map((_, i) => i + 1));
    pages.forEach(p => assert.ok(p.pairs.reduce((sum, pair) => sum + pair.height, 0) + (p.pairs.length - 1) * c.settings.groupGap <= m.body + 0.001));
    if (groupSize <= m.groupCapacity) assert.ok(blocks.every(b => !b.continued));
  }
});
test('项目验证拒绝无效名单，设置归一化', () => {
  const p = fixture(1); p.classes[0].settings.gap = -10;
  assert.equal(validateProject(p).classes[0].settings.gap, 8);
  p.classes[0].students[0].gender = '未知'; assert.throws(() => validateProject(p));
});
test('排版模板随项目和Excel恢复，旧项目兼容，模板参数独立', () => {
  const p = fixture(52), c = p.classes[0];
  p.templates = [{ id: 'template-1', name: '常用分组', settings: { ...c.settings, mode: 'group', groupSize: 6, autoFit: false } }];
  const restored = validateProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(restored.templates, p.templates);
  assert.deepEqual(importWorkbook(exportWorkbook(p)).project.templates, p.templates);
  restored.classes[0].settings = { ...restored.templates[0].settings };
  restored.classes[0].settings.groupSize = 8;
  assert.equal(restored.templates[0].settings.groupSize, 6);
  delete p.templates;
  assert.deepEqual(validateProject(p).templates, []);
  p.templates = [{ name: '' }]; assert.throws(() => validateProject(p));
});
test('多 Sheet Excel 包含颜色、A4、分页和隐藏元数据，可恢复名单及设置', () => {
  const p = fixture(75); const other = fixture(67).classes[0]; other.name = '一年/二班'; other.settings.mode = 'group'; p.classes.push(other);
  p.classes[0].settings.autoFit = false;
  const bytes = exportWorkbook(p), wb = XLSX.read(bytes, { type: 'array', cellStyles: true });
  assert.equal(wb.SheetNames.length, 3); assert.equal(wb.Workbook.Sheets[2].Hidden, 1);
  assert.ok(wb.Sheets[wb.SheetNames[0]].A4.s.fgColor);
  const zip = unzipSync(bytes), xml = strFromU8(zip['xl/worksheets/sheet1.xml']);
  assert.match(xml, /paperSize="9"/); assert.match(xml, /<rowBreaks/); assert.match(xml, /<pageMargins/);
  const r = importWorkbook(bytes);
  assert.equal(r.changes, 0);
  assert.deepEqual(r.project.classes.map(c => c.students.map(s => [s.name, s.gender])), p.classes.map(c => c.students.map(s => [s.name, s.gender])));
  assert.deepEqual(r.project.classes.map(c => c.settings), p.classes.map(c => c.settings));
});
test('52人自动适配男女双列及分组，保留顺序、手动参数与可读字号', () => {
  for (const mode of ['gender', 'group']) for (const male of [26, 34, 42, 52]) {
    const c = fixture(52).classes[0]; c.settings.mode = mode; c.settings.autoFit = true;
    c.students.forEach((p, i) => { p.gender = i < male ? '男' : '女'; });
    const saved = structuredClone(c.settings), s = layoutSettings(c), m = metrics(s), pages = planPages(c);
    assert.equal(pages.length, 1, `${mode}: ${male}男`);
    assert.ok(s.fontSize >= 9);
    assert.deepEqual(c.settings, saved);
    if (mode === 'gender') {
      assert.equal(pages[0].columns[0].length, male);
      assert.equal(pages[0].columns[1].length, 52 - male);
      assert.ok(Math.max(male, 52 - male) * m.row + m.heading <= m.body);
    } else {
      assert.deepEqual(pages[0].pairs.flatMap(p => p.blocks.filter(Boolean).flatMap(b => b.students.map(p => p.number))), Array.from({ length: 52 }, (_, i) => i + 1));
      assert.ok(pages[0].pairs.reduce((n, p) => n + p.height, 0) + (pages[0].pairs.length - 1) * s.groupGap <= m.body);
    }
    c.settings.autoFit = false;
    assert.ok(planPages(c).length > 1);
  }
});
test('自动适配达到字号下限后分页，Excel与项目恢复保留适配开关和手动设置', () => {
  const p = fixture(300), c = p.classes[0]; c.settings.autoFit = true; const s = layoutSettings(c);
  assert.ok(planPages(c).length > 1); assert.equal(s.fontSize, 9);
  for (const autoFit of [true, false]) {
    c.settings.autoFit = autoFit;
    assert.deepEqual(importWorkbook(exportWorkbook(p)).project.classes[0].settings, c.settings);
  }
  delete c.settings.autoFit;
  assert.equal(validateProject(p).classes[0].settings.autoFit, false);
});
test('Excel 展示表原位置改名和清空会覆盖旧元数据', () => {
  const p = fixture(8), wb = XLSX.read(exportWorkbook(p), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  ws.A4.v = '改过的姓名'; delete ws.C4;
  const r = importWorkbook(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
  assert.equal(r.changes, 2); assert.equal(r.project.classes[0].students.length, 7);
  assert.ok(r.project.classes[0].students.some(s => s.name === '改过的姓名'));
  assert.ok(!r.project.classes[0].students.some(s => s.name === '学生1'));
});
test('普通 Excel 支持多个班级、列顺序识别和无效行说明', () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['性别', '姓名'], ['女', '小红'], ['?', '错误行']]), '甲班');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['小明', '男']]), '乙班');
  const result = importWorkbook(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
  assert.equal(result.project.classes.length, 2); assert.equal(result.warnings.length, 1);
  assert.equal(result.project.classes[0].students[0].name, '小红');
});
