import { defaults, uid, newClass, newProject, validateProject, cleanSettings, parseText, duplicateNames, planPages, metrics, cellColor, layoutSettings } from './model.js';
import { exportWorkbook, importWorkbook } from './excel.js';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STORAGE = 'class-roster-project-v1';
let project = newProject(), storageOK = true, pendingImport = null, toastTimer;
let editingTemplateId = '', editingClassId = '';
const desktop = window.rosterDesktop;
$('fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch { toast('浏览器未允许全屏，请按 F11 隐藏浏览器栏；Esc 或 F11 可退出。'); }
};
document.addEventListener('fullscreenchange', () => {
  $('fullscreen').textContent = document.fullscreenElement ? '退出全屏' : '全屏使用';
});
try {
  const result = desktop?.load();
  if (result && !result.ok) throw new Error(result.error);
  const saved = desktop ? result.text : localStorage.getItem(STORAGE);
  if (saved) project = validateProject(JSON.parse(saved));
}
catch { storageOK = false; }
const current = () => project.classes.find(c => c.id === project.activeId) || project.classes[0];
function toast(message) { $('toast').textContent = message; $('toast').style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').style.display = 'none', 4500); }
function persist() {
  try {
    const text = JSON.stringify(project);
    if (desktop) { const result = desktop.save(text); if (!result.ok) throw new Error(result.error); }
    else localStorage.setItem(STORAGE, text);
    storageOK = true; $('save-status').textContent = desktop ? '已保存到程序旁的 data 文件夹' : '已在本浏览器暂存 · 请定期保存项目';
  }
  catch (error) { storageOK = false; $('save-status').textContent = '保存失败 · 请保存项目文件'; if (desktop) toast(`自动保存失败：${error.message}`); }
}
function update() { persist(); render(); }
function renderTabs() {
  $('class-tabs').innerHTML = project.classes.map(c => `<button class="class-tab ${c.id === current().id ? 'active' : ''}" data-class="${escape(c.id)}" aria-current="${c.id === current().id ? 'true' : 'false'}"><span>${escape(c.name)}</span><small>${c.students.length} 人</small></button>`).join('');
  $('class-name').textContent = current().name;
  $('student-count').textContent = `${current().students.length} 人`;
}
function renderRows() {
  $('member-rows').innerHTML = current().students.map((p, i) => `<tr data-student="${escape(p.id)}"><td>${i + 1}</td><td><input class="student-input" aria-label="第${i + 1}位学生姓名" value="${escape(p.name)}" maxlength="80"></td><td><select class="gender-input" aria-label="第${i + 1}位学生性别"><option ${p.gender === '男' ? 'selected' : ''}>男</option><option ${p.gender === '女' ? 'selected' : ''}>女</option></select></td><td><div class="row-actions"><button data-action="up" title="上移" ${i === 0 ? 'disabled' : ''}>↑</button><button data-action="down" title="下移" ${i === current().students.length - 1 ? 'disabled' : ''}>↓</button><button data-action="delete" title="删除学生">×</button></div></td></tr>`).join('');
  $('empty-list').hidden = current().students.length > 0;
}
function renderSettings() {
  if (current().settings.autoFit) {
    const fitted = layoutSettings(current()), m = metrics(fitted);
    current().settings = cleanSettings({ ...fitted, autoFit: false, rowHeight: m.row - 0.6, layoutRow: m.row, layoutHeading: m.heading });
    persist();
  }
  const s = current().settings;
  Object.keys(defaults).forEach(key => { if ($(key).type === 'checkbox') $(key).checked = s[key]; else $(key).value = s[key]; });
  $('groupSize').disabled = false;
  $('groupGap').disabled = false;
  const selected = $('layout-template').value;
  $('layout-template').innerHTML = '<option value="">请选择模板</option>' + (project.templates || []).map(t => `<option value="${escape(t.id)}">${escape(t.name)}</option>`).join('');
  $('template-list').innerHTML = (project.templates || []).length ? project.templates.map(t => `<div class="layout-note"><strong>${escape(t.name)}</strong><p>${t.settings.mode === 'group' ? `分组双列 · 每组 ${t.settings.groupSize} 人` : '男女双列 · 男左女右'} · ${t.settings.fontSize} pt · ${t.settings.autoFit ? '自动适配一页' : '手动排版'}</p><div class="paste-actions"><button class="primary" data-template-edit="${escape(t.id)}">编辑</button><button data-template-apply="${escape(t.id)}">套用到当前班级</button></div></div>`).join('') : '<div class="hint">还没有保存的模板。设置好排版后，点击下方“保存为模板”。</div>';
  $('layout-template').value = selected;
  $('apply-template').disabled = $('delete-template').disabled = !$('layout-template').value;
  renderTemplateEditor();
  const fitted = layoutSettings(current()), pages = planPages(current());
  $('fit-status').textContent = `当前 ${pages.length} 页 · 实际行高 ${metrics(fitted).row.toFixed(2)} mm。点击“一键适配 A4”调整为单页排版，之后可自由修改；名单变化不会自动重算。`;
  $('geometry').textContent = `左 ${s.margin} mm ＋ 左列 ${metrics(s).columnWidth.toFixed(1)} mm ＋ 中间 ${s.gap} mm ＋ 右列 ${metrics(s).columnWidth.toFixed(1)} mm ＋ 右 ${s.margin} mm ＝ 210 mm`;
}
function selectedClasses() { return $('scope').value === 'all' ? project.classes : [current()]; }
function cell(p, s, index, offset = 0) {
  return `<div class="student-cell" style="height:${metrics(s).row - 0.6}mm;font-size:${s.fontSize}pt;background:#${cellColor(s, index, offset)}">${s.showNumbers ? `<span class="number">${p.number}.</span>` : ''}<span class="student-name">${escape(p.name)}</span></div>`;
}
function renderPreview() {
  let count = 0;
  $('preview-pages').innerHTML = selectedClasses().map(cls => {
    const s = layoutSettings(cls), pages = planPages(cls), male = cls.students.filter(p => p.gender === '男').length;
    count += pages.length;
    return pages.map((page, pi) => {
      let content = '';
      if (!cls.students.length) content = '<div class="paper-empty">添加学生后，这里将显示花名册</div>';
      else if (page.mode === 'gender') content = page.columns.map((list, ci) => `<div class="paper-column"><div class="column-heading" style="height:${metrics(s).heading}mm;margin-bottom:0">${ci ? '女生' : '男生'}</div>${list.map(p => cell(p, s, ci)).join('')}</div>`).join('');
      else content = page.pairs.map(pair => pair.blocks.map(b => `<div class="group-block" style="height:${pair.height}mm">${b ? `<div class="group-heading" style="height:${metrics(s).heading}mm">第 ${b.index + 1} 组${b.continued ? '（续）' : ''}</div>${b.students.map((p, j) => cell(p, s, b.index, b.offset + j)).join('')}` : ''}</div>`).join('')).join('');
      return `<div class="page-wrapper"><article class="paper" style="padding:${s.verticalMargin}mm ${s.margin}mm"><div class="paper-title" title="${escape(s.title || cls.name + '花名册')}">${escape(s.title || cls.name + '花名册')}</div><div class="paper-subtitle">${escape(cls.name)} · 共 ${cls.students.length} 人 · 男 ${male} 人 / 女 ${cls.students.length - male} 人${s.mode === 'group' ? ` · 每组 ${s.groupSize} 人` : ''}</div><div class="paper-grid" style="column-gap:${s.gap}mm;row-gap:${s.mode === 'group' ? s.groupGap : 0}mm">${content}</div><div class="paper-footer">${escape(cls.name)} · 第 ${pi + 1} / ${pages.length} 页</div></article></div>`;
    }).join('');
  }).join('');
  $('page-count').textContent = `共 ${count} 页`;
  resizePreview();
}
function resizePreview() {
  const width = 210 * 96 / 25.4, height = 297 * 96 / 25.4;
  const scale = $('zoom').value === 'fit' ? Math.max(0.2, Math.min(1, ($('preview-scroll').clientWidth - 48) / width)) : Number($('zoom').value);
  $('preview-pages').style.width = `${width * scale}px`;
  document.querySelectorAll('.page-wrapper').forEach(el => { el.style.width = `${width * scale}px`; el.style.height = `${height * scale}px`; el.firstElementChild.style.transform = `scale(${scale})`; });
}
function render() { renderTabs(); renderRows(); renderSettings(); renderPreview(); }
function download(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function projectStamp() { return new Date().toISOString().slice(0, 10); }
function showImport(summary, details, action, valid = true) {
  $('import-summary').textContent = summary; $('import-details').textContent = details; $('confirm-import').disabled = !valid; pendingImport = action; $('import-dialog').showModal();
}
function readFile(input, handler) {
  input.addEventListener('change', async () => {
    const file = input.files[0]; if (!file) return;
    try { if (file.size > 30 * 1024 * 1024) throw new Error('文件不能超过 30 MB。'); await handler(file); }
    catch (e) { toast(`打开失败：${e.message}`); }
    finally { input.value = ''; }
  });
}
$('class-tabs').addEventListener('click', e => { const b = e.target.closest('[data-class]'); if (b) { project.activeId = b.dataset.class; $('paste-input').value = ''; update(); } });
function askText(title, value = '') {
  return new Promise(resolve => {
    $('text-dialog-title').textContent = title;
    $('text-dialog-input').value = value;
    $('text-dialog').addEventListener('close', () => resolve($('text-dialog').returnValue === 'ok' ? $('text-dialog-input').value.trim() : ''), { once: true });
    $('text-dialog').returnValue = '';
    $('text-dialog').showModal(); $('text-dialog-input').focus(); $('text-dialog-input').select();
  });
}
$('add-class').onclick = async () => {
  if (project.classes.length >= 200) return toast('最多支持 200 个班级。');
  const name = await askText('新班级名称', `班级 ${project.classes.length + 1}`);
  if (name) { const c = newClass(name.slice(0, 80)); project.classes.push(c); project.activeId = c.id; update(); }
};
$('rename-class').onclick = async () => { const name = await askText('班级名称', current().name); if (name) { current().name = name.slice(0, 80); update(); } };
$('delete-class').onclick = () => {
  if (!confirm(`删除「${current().name}」及其名单？请确认已保存所需数据。`)) return;
  project.classes = project.classes.filter(c => c.id !== current().id);
  if (!project.classes.length) project.classes.push(newClass('我的班级'));
  project.activeId = project.classes[0].id; update();
};
document.querySelector('.tab-bar').addEventListener('click', e => {
  const button = e.target.closest('[data-panel]'); if (!button) return;
  document.querySelectorAll('[data-panel]').forEach(b => b.classList.toggle('active', b === button));
  for (const name of ['members', 'layout', 'templates']) $(name + '-panel').hidden = button.dataset.panel !== name;
});
$('add-student').onclick = async () => {
  if (current().students.length >= 10000) return toast('每班最多支持 10000 人。');
  const name = await askText('学生姓名'); if (!name) return;
  current().students.push({ id: uid(), name: name.slice(0, 80), gender: '男' }); update();
  const rows = $('member-rows').querySelectorAll('tr'); rows[rows.length - 1]?.querySelector('select').focus();
  toast('已添加学生，可在列表中调整性别。');
};
$('member-rows').addEventListener('change', e => {
  const row = e.target.closest('[data-student]'); if (!row) return;
  const p = current().students.find(s => s.id === row.dataset.student); if (!p) return;
  if (e.target.classList.contains('student-input')) { const name = e.target.value.trim(); if (!name) { e.target.value = p.name; return toast('姓名不能为空。'); } p.name = name; }
  else if (e.target.classList.contains('gender-input')) p.gender = e.target.value;
  persist(); renderTabs(); renderPreview();
});
$('member-rows').addEventListener('click', e => {
  const button = e.target.closest('[data-action]'); if (!button) return;
  const list = current().students, i = list.findIndex(p => p.id === button.closest('tr').dataset.student);
  if (button.dataset.action === 'delete') list.splice(i, 1);
  else { const j = i + (button.dataset.action === 'up' ? -1 : 1); if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; }
  update();
});
$('paste-import').onclick = () => {
  const parsed = parseText($('paste-input').value), replace = $('replace-list').checked;
  const combined = replace ? parsed.rows : [...current().students, ...parsed.rows]; const duplicates = duplicateNames(combined);
  const details = [...parsed.errors, ...(duplicates.length ? [`同名提醒（允许保留）：${duplicates.join('、')}`] : []), '', ...parsed.rows.map((s, i) => `${i + 1}. ${s.name}　${s.gender}`)].join('\n');
  const valid = parsed.rows.length > 0 && !parsed.errors.length && combined.length <= 10000;
  showImport(`${replace ? '替换' : '追加'}至「${current().name}」：${parsed.rows.length} 人，${parsed.errors.length} 行需修正。${combined.length > 10000 ? '总人数超过 10000 人。' : ''}${parsed.errors.length ? '请取消并修正后重新导入。' : ''}`, details, () => { current().students = combined; $('paste-input').value = ''; update(); toast('名单已导入。'); }, valid);
};
Object.keys(defaults).forEach(key => $(key).addEventListener('change', () => {
  const value = $(key).type === 'checkbox' ? $(key).checked : $(key).value;
  const changes = { [key]: value };
  if (key === 'groupSize' || key === 'groupGap') changes.mode = 'group';
  changes.autoFit = false;
  const next = { ...current().settings, ...changes };
  if (key === 'rowHeight' || key === 'fontSize') delete next.layoutRow;
  current().settings = cleanSettings(next); persist(); renderSettings(); renderPreview();
}));
$('fit-one-page').onclick = () => {
  const base = { ...current().settings, autoFit: true };
  delete base.layoutRow; delete base.layoutHeading;
  const fitted = layoutSettings({ ...current(), settings: base });
  const m = metrics(fitted);
  current().settings = cleanSettings({ ...fitted, autoFit: false, rowHeight: m.row - 0.6, layoutRow: m.row, layoutHeading: m.heading });
  update();
  toast(planPages(current()).length === 1 ? '已适配为 A4 单页，可继续手动修改并保存。' : '已优化排版，达到可读字号下限后仍需分页，可继续手动修改。');
};
$('reset-layout').onclick = () => { current().settings = { ...defaults }; update(); };
$('save-layout').onclick = () => saveTemplate();
function renderTemplateEditor() {
  const template = project.templates?.find(t => t.id === editingTemplateId);
  if (!template || editingClassId !== current().id) editingTemplateId = '';
  const editing = !!editingTemplateId;
  $('edit-template').disabled = !$('layout-template').value;
  $('update-template').disabled = !editing;
  $('template-edit-status').textContent = editing ? `正在编辑「${template.name}」：修改上方排版参数后，点击“保存模板修改”更新原模板。当前班级同步显示并保存此排版；其他班级已套用的设置不受影响。` : '在“模板列表”中选择已保存的模板，点击“编辑模板”即可重新载入并修改。';
}
$('layout-template').onchange = () => {
  editingTemplateId = '';
  $('apply-template').disabled = $('delete-template').disabled = !$('layout-template').value;
  renderTemplateEditor();
};
$('edit-template').onclick = () => {
  const template = project.templates?.find(t => t.id === $('layout-template').value);
  if (!template) return;
  editingTemplateId = template.id; editingClassId = current().id;
  current().settings = cleanSettings(template.settings); update();
  document.querySelector('[data-panel="layout"]').click();
  $('layout-panel').scrollTop = 0;
  toast(`已载入「${template.name}」，修改后点击“保存模板修改”。`);
};
$('template-list').onclick = e => {
  const button = e.target.closest('[data-template-edit], [data-template-apply]');
  if (!button) return;
  $('layout-template').value = button.dataset.templateEdit || button.dataset.templateApply;
  $('layout-template').onchange();
  if (button.dataset.templateEdit) $('edit-template').click();
  else $('apply-template').click();
};
$('update-template').onclick = () => {
  const template = project.templates?.find(t => t.id === editingTemplateId);
  if (!template || editingClassId !== current().id) return;
  const settings = Object.fromEntries(Object.keys(defaults).map(key => [key, $(key).type === 'checkbox' ? $(key).checked : $(key).value]));
  template.settings = cleanSettings({ ...current().settings, ...settings });
  current().settings = cleanSettings(template.settings); update();
  toast(storageOK ? `排版模板「${template.name}」修改已保存。` : '模板暂存失败，请点击顶部“保存项目”下载保存。');
};
async function saveTemplate() {
  const cls = current();
  const settings = cleanSettings({ ...cls.settings, ...Object.fromEntries(Object.keys(defaults).map(key => [key, $(key).type === 'checkbox' ? $(key).checked : $(key).value])) });
  const name = await askText('保存排版模板名称', `${current().name}排版`);
  if (!name) return;
  project.templates ||= [];
  const existing = project.templates.find(t => t.name === name);
  if (existing && !confirm(`覆盖已有模板「${name}」？`)) return;
  if (!existing && project.templates.length >= 200) return toast('最多支持 200 个排版模板。');
  const template = { id: existing?.id || uid(), name, settings };
  cls.settings = cleanSettings(settings);
  project.templates = [template, ...project.templates.filter(t => t.id !== template.id)];
  editingTemplateId = template.id; editingClassId = cls.id;
  update(); $('layout-template').value = template.id;
  $('apply-template').disabled = $('delete-template').disabled = false;
  renderTemplateEditor();
  document.querySelector('[data-panel="templates"]').click();
  $('templates-panel').scrollTop = 0;
  toast(storageOK ? `排版模板「${name}」已保存，已显示在模板列表首位。` : '模板暂存失败，请点击顶部“保存项目”下载保存。');
}
$('save-template').onclick = () => saveTemplate();
$('apply-template').onclick = () => {
  const template = project.templates?.find(t => t.id === $('layout-template').value);
  if (!template) return;
  editingTemplateId = template.id; editingClassId = current().id;
  current().settings = cleanSettings(template.settings); update();
  toast(`已套用「${template.name}」，并按当前班级人数重新排版。`);
  document.querySelector('[data-panel="layout"]').click();
};
$('delete-template').onclick = () => {
  const template = project.templates?.find(t => t.id === $('layout-template').value);
  if (!template || !confirm(`删除排版模板「${template.name}」？`)) return;
  project.templates = project.templates.filter(t => t.id !== template.id); update(); toast('排版模板已删除。');
};
$('scope').onchange = renderPreview; $('zoom').onchange = resizePreview;
new ResizeObserver(resizePreview).observe($('preview-scroll'));
$('save-project').onclick = () => { download(JSON.stringify(project, null, 2), `班级花名册-${projectStamp()}.json`, 'application/json'); toast('项目已下载，请保留此文件用于恢复或迁移。'); };
$('open-project').onclick = () => $('project-file').click();
readFile($('project-file'), async file => {
  const next = validateProject(JSON.parse(await file.text()));
  showImport(`打开项目：${next.classes.length} 个班级，共 ${next.classes.reduce((n, c) => n + c.students.length, 0)} 人。将替换当前项目，请先保存现有数据。`, next.classes.map(c => `${c.name}：${c.students.length} 人`).join('\n'), () => { project = next; update(); toast('项目已恢复。'); });
});
$('export-excel').onclick = () => {
  try { download(exportWorkbook(project), `班级花名册-${projectStamp()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('已导出全部班级，包含配色、双列排版、A4 设置和恢复数据。'); }
  catch (e) { toast(`导出失败：${e.message}`); }
};
$('import-excel').onclick = () => $('excel-file').click();
readFile($('excel-file'), async file => {
  const result = importWorkbook(await file.arrayBuffer());
  const count = result.project.classes.reduce((n, c) => n + c.students.length, 0);
  const summary = `读取到 ${result.project.classes.length} 个班级、${count} 人。${result.source === 'archive' ? `完整恢复项目与设置，检测到 ${result.changes} 处姓名变更。将替换当前项目。` : '普通名单将作为新班级追加，使用默认排版。'}${result.warnings.length ? '请阅读下方导入说明。' : ''}`;
  const duplicates = result.project.classes.flatMap(c => { const d = duplicateNames(c.students); return d.length ? [`「${c.name}」同名：${d.join('、')}`] : []; });
  showImport(summary, [...result.warnings, ...duplicates, '', ...result.project.classes.map(c => `${c.name}：${c.students.length} 人`)].join('\n'), () => {
    if (result.source === 'archive') project = result.project;
    else { if (project.classes.length + result.project.classes.length > 200) return toast('合计超过 200 个班级，请减少班级后导入。'); project.classes.push(...result.project.classes); project.activeId = result.project.activeId; }
    update(); toast('Excel 已导入。');
  });
});
function closeImport() { pendingImport = null; $('import-dialog').close(); }
$('close-import').onclick = closeImport; $('cancel-import').onclick = closeImport;
$('import-dialog').addEventListener('cancel', () => pendingImport = null);
$('confirm-import').onclick = () => { const action = pendingImport; closeImport(); action?.(); };
$('print').onclick = async () => {
  renderPreview();
  if (!desktop) return window.print();
  const result = await desktop.print();
  if (!result.ok) toast(`输出失败：${result.error}`);
  else if (result.saved) toast('PDF 已保存。');
};
if (desktop) {
  $('fullscreen').hidden = true;
  document.querySelector('.print-tip').textContent = '独立桌面版 · F11 全屏 / Esc 退出全屏。打印与 PDF 自动保留背景色和 A4 页面。';
  document.querySelector('.sidebar-note span').textContent = '● 桌面便携版 · 数据随程序保存';
}
render();
if (!storageOK) { $('save-status').textContent = '数据恢复失败 · 请打开项目文件'; toast('保存的数据不可用或已损坏，请使用项目文件恢复。'); }
