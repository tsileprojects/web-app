"""Builds programs.json (all programs from the portal menus) for the phone app.
Run after changing any portal menu:  python3 tools_build_programs.py"""
import glob, json, re
from html.parser import HTMLParser

class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.items = []; s.group = ''; s.in_sum = False; s.in_link = None; s.buf = ''; s.depth_nav = 0; s.in_nav = False
    def handle_starttag(s, tag, a):
        a = dict(a)
        if tag == 'nav': s.in_nav = True
        if not s.in_nav: return
        if tag == 'details': s.group = ''
        if tag == 'summary': s.in_sum = True; s.buf = ''
        if tag == 'a' and 'menu-link' in (a.get('class') or ''):
            s.in_link = a.get('data-embed') or a.get('href') or ''; s.buf = ''
    def handle_endtag(s, tag):
        if tag == 'nav': s.in_nav = False
        if tag == 'summary' and s.in_sum: s.group = re.sub(r'\s+', ' ', s.buf).strip(); s.in_sum = False
        if tag == 'details': s.group = ''
        if tag == 'a' and s.in_link is not None:
            name = re.sub(r'\s+', ' ', s.buf).strip()
            if s.in_link and s.in_link not in ('#', 'home.html') and name:
                s.items.append({'name': name, 'url': s.in_link, 'group': s.group})
            s.in_link = None
    def handle_data(s, d):
        if s.in_sum or s.in_link is not None: s.buf += d

out = []
names = {'main_ho': 'HO'}
for f in ['main_ho.html'] + sorted(glob.glob('unit_*.html')) + sorted(glob.glob('dept_*.html')):
    p = P(); p.feed(open(f, encoding='utf-8', errors='ignore').read())
    portal = names.get(f[:-5], f[:-5].split('_', 1)[1].upper().replace('_', ' '))
    for it in p.items:
        it['portal'] = portal
        out.append(it)
# merge duplicates (same url) keeping all portals
merged = {}
for it in out:
    m = merged.setdefault(it['url'], {'name': it['name'], 'url': it['url'], 'group': it['group'], 'portals': []})
    if it['portal'] not in m['portals']: m['portals'].append(it['portal'])
json.dump({'built': __import__('datetime').date.today().isoformat(), 'programs': list(merged.values())}, open('programs.json', 'w'), ensure_ascii=False, indent=0)
print(len(out), 'links,', len(merged), 'unique programs')
