import fs from 'node:fs';
const BS = String.fromCharCode(92);
let t = fs.readFileSync('_assembled.json','utf8');

// 1) double backslashes (paths)
t = t.split(BS).join(BS+BS);

// 2) trailing commas before ] / }
t = t.replace(/,(\s*[}\]])/g, '$1');

// 3) ID normalization
t = t.replaceAll('superpower_sdd_11_01_plan_task_4_report_icon_swap','_superpowers_sdd_11_01_plan_task_4_report_icon_swap');
t = t.replaceAll('superpowers_sdd_2026_08_12_phase0_progress_env_blockers','_superpowers_sdd_2026_08_12_ui_ux_rework_phase0_design_system_progress_env_blockers');
t = t.replaceAll('_superpowers_sdd_2026_08_12_phase0_','_superpowers_sdd_2026_08_12_ui_ux_rework_phase0_design_system_');
t = t.replaceAll('_superpowers_sdd_2026_08_13_phase1_','_superpowers_sdd_2026_08_13_ui_ux_rework_phase1_shell_');
t = t.replaceAll('_superpowers_sdd_2026_08_13_ui_ux_rework_phase1_shell_task1_brief_admin_nav_model','_superpowers_sdd_2026_08_13_ui_ux_rework_phase1_shell_task_1_brief_admin_nav_model');
t = t.replaceAll('superpower_sdd_11_01_plan_task_3_report_icon_mapping','_superpowers_sdd_11_01_plan_task_3_report_icon_mapping');

fs.writeFileSync('_assembled.json', t);
const d = JSON.parse(t);
console.log('PARSE OK:', d.nodes.length, 'nodes,', d.edges.length, 'edges,', d.hyperedges.length, 'hyperedges');
fs.writeFileSync('_stats.json', JSON.stringify({nodes:d.nodes.length,edges:d.edges.length,hyperedges:d.hyperedges.length}));
