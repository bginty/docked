import json,sys,re,glob
sys.path.insert(0,'private-data/roster-parser')
import mwparserfromhell as mw
root='private-data/roster-source-review/'
rows=json.load(open(root+'discovered.json',encoding='utf8'))
replaced_teams={'Brisbane Broncos','New Zealand Warriors','North Queensland Cowboys'}
rows=[r for r in rows if not (r['sport']=='nrl' and (r['season']!='2026' or r['team'] in replaced_teams))]
for file in glob.glob(root+'nrl-history-*.json'):
 d=json.load(open(file,encoding='utf8'));p=d['query']['pages'][0];rev=p['revisions'][0]
 team=p['title'].replace('Template:','').replace(' current squad','')
 for t in mw.parse(rev['slots']['main']['content']).filter_templates():
  if str(t.name).strip().lower() not in ['rls player','rugby league squad player'] or not t.has('name'):continue
  name=t.get('name').value;links=name.filter_wikilinks()
  if not links:continue
  pos=[str(t.get(k).value).strip() for k in ['pos','pos2','pos3'] if t.has(k)]
  rows.append(dict(sport='nrl',team=team,rosterPage=p['title'],rosterRevision=rev['revid'],rosterObservedAt=rev['timestamp'],sourceTitle=str(links[0].title),name=name.strip_code(),rosterPosition='/'.join(pos),number=None,registration='listed',season='2026'))
json.dump(rows,open(root+'discovered.json','w',encoding='utf8'),ensure_ascii=False,indent=2)
print('Discovery candidates',len(rows))
