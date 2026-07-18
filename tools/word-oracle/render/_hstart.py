import json,re,sys
from collections import Counter
norm=lambda s: re.sub(r'\s+',' ',str(s or '')).strip()
B,F=sys.argv[1],sys.argv[2]
t=json.load(open('corpus/ground-truth/%s.truth.json'%B,encoding='utf-8'))
o=json.load(open(F,encoding='utf-8'))
tc=Counter(norm(l['text']) for p in t['pages'] for l in p['lines'])
oc=Counter(norm(l.get('text')) for p in o['pages'] for l in p['lines'] if l.get('xMin') is not None)
tmap={norm(l['text']):l for p in t['pages'] for l in p['lines']}
omap={norm(l.get('text')):l for p in o['pages'] for l in p['lines'] if l.get('xMin') is not None}
d=[]
for k,c in tc.items():
    if k and c==1 and oc.get(k)==1: d.append(omap[k]['xMax']-tmap[k]['xMax'])
d.sort(); n=len(d)
ok=sum(1 for x in d if abs(x)<=60)
print('  %-16s ن=%3d وسيطُ البداية=%+6.0ftw  ضمن±60tw: %3d%%'%(B,n,d[n//2],round(100*ok/n)))
