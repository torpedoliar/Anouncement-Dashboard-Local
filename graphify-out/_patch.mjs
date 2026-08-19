import fs from "node:fs";
let s = fs.readFileSync("_c02_build.json", "utf8");
const p = "E:\Vibe\Dashboard SJA\announcement-dashboard\\";
const fixes = [
  ['_ss_2026_08_12_phase0_task1_brief_font_variables', '_superpowers_sdd_2026_08_12_ui_ux_rework_phase0_design_system_task_1_brief_font_variables'],
  ['E:\\Vibe\\Turing', p + '.superpowers\\sdd\\'],
  ['\.weird\', '\.superpowers\sdd\'],
  ['2026-0bers8-12', '2026-08-12'],
];
for (const [a, b] of fixes) {
  const n = s.split(a).length - 1;
  if (n) { s = s.split(a).join(b); console.log('fixed', n, JSON.stringify(a)); }
}
fs.writeFileSync("_c02_build.json", s);
const re = /"source_file":"([^"]*)"/g;
const seen = new Set();
let m;
console.log('--- distinct source_files ---');
while ((m = re.exec(s))) { if (!seen.has(m[1])) { seen.add(m[1]); console.log(m[1]); } }
