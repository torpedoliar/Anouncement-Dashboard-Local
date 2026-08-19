import re
p = open('graphify-out/GRAPH_REPORT.md', encoding='utf-8', errors='replace').read()
for sec in ['Surprising Connections', 'Suggested Questions']:
    m = re.search(r'(#+\s*' + sec + r'.*?)(?=\n#+\s|\Z)', p, re.S)
    if m:
        print(m.group(1)[:3000])
        print('=' * 60)