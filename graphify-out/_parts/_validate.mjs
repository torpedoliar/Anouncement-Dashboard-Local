import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('_assembled.json','utf8'));
const BS = String.fromCharCode(92);
const ROOT = 'E:' + BS + 'Vibe' + BS + 'Dashboard SJA' + BS + 'announcement-dashboard' + BS;
const canonical = [
 '.superpowers'+BS+'sdd'+BS+'11-01-PLAN'+BS+'task-2-report.md',
 '.superpowers'+BS+'sdd'+BS+'11-01-PLAN'+BS+'task-3-report.md',
 '.superpowers'+BS+'sdd'+BS+'11-01-PLAN'+BS+'task-4-report.md',
 '.superpowers'+BS+'sdd'+BS+'2026-08-12-ui-ux-rework-phase0-design-system'+BS+'progress.md',
 '.superpowers'+BS+'sdd'+BS+'2026-08-12-ui-ux-rework-phase0-design-system'+BS+'task-1-brief.md',
 '.superpowers'+BS+'sdd'+BS+'2026-08-12-ui-ux-rework-phase0-design-system'+BS+'task-1-report.md',
 '.superpowers'+BS+'sdd'+BS+'2026-08-12-ui-ux-rework-phase0-design-system'+BS+'task-2-brief.md',
 '.superpowers'+BS+'sdd'+BS+'2026-08-12-ui-ux-rework-phase0-design-system'+BS+'task-2-report.md',
 '.superpowers'+BS+'sdd'+BS+'2026-08-12-ui-ux-rework-phase0-design-system'+BS+'task-3-brief.md',
 '.superpowers'+BS+'sdd'+BS+'2026-08-12-ui-ux-rework-phase0-design-system'+BS+'task-4-brief.md',
 '.superpowers'+BS+'sdd'+BS+'2026-08-12-ui-ux-rework-phase0-design-system'+BS+'task-4-report.md',
 '.superpowers'+BS+'sdd'+BS+'2026-08-12-ui-ux-rework-phase0-design-system'+BS+'task-5-brief.md',
 '.superpowers'+BS+'sdd'+BS+'2026-08-12-ui-ux-rework-phase0-design-system'+BS+'task-5-report.md',
 '.superpowers'+BS+'sdd'+BS+'2026-08-12-ui-ux-rework-phase0-design-system'+BS+'task-6-brief.md',
 '.superpowers'+BS+'sdd'+BS+'2026-08-13-ui-ux-rework-phase1-shell'+BS+'progress.md',
 '.superpowers'+BS+'sdd'+BS+'2026-08-13-ui-ux-rework-phase1-shell'+BS+'task-1-brief.md',
 '.superpowers'+BS+'sdd'+BS+'2026-08-13-ui-ux-rework-phase1-shell'+BS+'task-1-report.md',
 '.superpowers'+BS+'sdd'+BS+'2026-08-13-ui-ux-rework-phase1-shell'+BS+'task-2-brief.md',
 '.superpowers'+BS+'sdd'+BS+'2026-08-13-ui-ux-rework-phase1-shell'+BS+'task-3-brief.md',
 '.superpowers'+BS+'sdd'+BS+'2026-08-13-ui-ux-rework-phase1-shell'+BS+'task-4-brief.md',
 'CLAUDE.md','HANDOFF-PHASE2.md','HANDOFF-PHASE3.md',
 'docs'+BS+'agents'+BS+'domain.md','docs'+BS+'agents'+BS+'issue-tracker.md'
].map(s => ROOT + s);
const canon = new Set(canonical);

let bad = 0;
for (const n of d.nodes) {
  if (!canon.has(n.source_file)) { console.log('BAD NODE source_file:', n.id, '=>', n.source_file); bad++; }
  if (typeof n.id !== 'string' || !/^[a-z0-9_]+$/.test(n.id)) { console.log('BAD NODE id:', n.id); bad++; }
}
for (const e of d.edges) {
  if (!canon.has(e.source_file)) { console.log('BAD EDGE source_file:', e.source, '=>', e.source_file); bad++; }
  if (e.source === e.target) { console.log('SELF EDGE:', e.source); bad++; }
}
const ids = new Set(d.nodes.map(n=>n.id));
if (ids.size !== d.nodes.length) { console.log('DUP NODE IDS'); bad++; }
for (const e of d.edges) {
  if (!ids.has(e.source)) { console.log('EDGE MISSING SOURCE:', e.source); bad++; }
  if (!ids.has(e.target)) { console.log('EDGE MISSING TARGET:', e.target, 'from', e.source); bad++; }
}
// bad edge to drop
const bogus = d.edges.filter(e => e.source.startsWith('_superpowers_sdd_11_01_plan_task_2_report_frozen_sso_contracts') && e.target==='_superpowers_sdd_2026_08_12_ui_ux_rework_phase0_design_system_task4_brief_ui_kit');
console.log('BOGUS EDGES FOUND:', bogus.length, bogus.map(e=>e.relation+':'+e.confidence));
console.log(bad === 0 ? 'ALL CLEAN' : 'ISSUES: ' + bad);
