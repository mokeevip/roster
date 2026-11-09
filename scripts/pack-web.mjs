import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';
const html = await readFile('班级花名册.html');
const instructions = `班级花名册 · 离线网页版\r\n\r\n解压后双击“班级花名册.html”，使用新版 Edge 或 Chrome 打开。无需安装或联网。\r\n\r\n1. 新建班级，粘贴 Excel 的姓名、性别两列，或手动添加。\r\n2. 排版设置可选择男女双列或分组双列，两列等宽、留白对称。\r\n3. 请定期点击“保存项目”下载 JSON 文件；“打开项目”可恢复全部名单和格式。\r\n4. Excel 导出包含所有班级、颜色和打印设置；再次导入可恢复应用数据。\r\n5. 打印请选择 A4、100% 比例，关闭页眉页脚，开启背景图形；可另存为 PDF。\r\n\r\n此版本在普通浏览器中运行，会显示浏览器标签页和地址栏。\r\n名单暂存在当前浏览器中，不会写入 HTML。移动电脑请同时带上保存的项目文件。\r\nExcel 中可在原位置改名或清空姓名；移动/插入行列、性别及排版调整请在应用中完成。\r\n`;
const fullscreenHelp = '\r\n隐藏浏览器栏：打开后点击顶部“全屏使用”，按 Esc 退出；也可按 F11。普通 HTML 无法自动隐藏浏览器界面，如需双击即独立窗口，请使用 EXE 版。\r\n';
await mkdir('release', { recursive: true });
await writeFile('release/班级花名册-网页版.zip', zipSync({ '班级花名册-网页版/班级花名册.html': html, '班级花名册-网页版/使用说明.txt': strToU8('\uFEFF' + instructions + fullscreenHelp) }, { level: 9 }));
console.log('已生成 release/班级花名册-网页版.zip');
