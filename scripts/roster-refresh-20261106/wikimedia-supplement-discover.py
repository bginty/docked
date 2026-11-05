"""Extract only the three exact fetched 2026 squad sections (no stats/images)."""
import json,re,sys,urllib.parse,collections
from pathlib import Path
sys.path.insert(0,'C:/Users/61412/.codex/worktrees/fixed-market-live/Docked.com.au/private-data/roster-parser')
from bs4 import BeautifulSoup
root=Path('private-data/roster-refresh-20261106/wikimedia/supplement');out=Path('docs/qa/roster-refresh-20261106/wikimedia')
observations=json.loads((out/'supplement-observations.json').read_text(encoding='utf8'));assert len(observations)==3
plain_codes={'Fullback':'FB','Wing':'WG','Centre':'CE','Five-eighth':'FE','Halfback':'HB','Prop':'PR','Hooker':'HK','Second-row':'SR','Lock':'LK'}
rows=[]
def first_link(parent):return next((a for a in parent.find_all('a') if a.get('href','').startswith('/wiki/') and not a.get('href','').startswith('/wiki/File:')),None)
for o in observations:
 d=json.loads((root/(o['key']+'-squad.json')).read_text(encoding='utf8'));p=d['parse'];assert p['revid']==o['revision'] and p['title']==o['page'] and p['title'].startswith('2026 ')
 s=BeautifulSoup(p['text'],'html.parser');table=next(t for t in s.select('table') if not t.find_parent('table'))
 candidates=[]
 if o['key']=='bri':
  assert 'Player Position Broncos debut' in table.get_text(' ',strip=True)[:110]
  for tr in table.select('tr'):
   cells=tr.find_all('td',recursive=False)
   if len(cells)<4:continue
   pos=cells[3].get_text(' ',strip=True)
   assert pos in plain_codes
   a=first_link(cells[2]);
   if a:candidates.append((a,plain_codes[pos]))
 else:
  assert re.search(r'Top 30 squad\s*[-–—]\s*2026 NRL season',table.get_text(' ',strip=True)[:200])
  for li in table.select('li'):
   if li.find_parent('li'):continue
   txt=li.get_text(' ',strip=True)
   if not re.search(r'[–—]\s*(?:FB|WG|CE|FE|HB|PR|HK|SR|LK)',txt):continue
   a=first_link(li)
   if a:candidates.append((a,re.split(r'[–—]',txt)[-1].strip()))
 for a,pos in candidates:
  rows.append({'sport':'nrl','team':o['team'],'sourceContext':'explicit-2026-season-article-squad','sourceTitle':urllib.parse.unquote(a['href'][6:]).replace('_',' '),'name':a.get_text(' ',strip=True),'rosterPosition':pos,'number':None,'sourceSeason':'2026','rootDeclaredSeason':'2026','teamDeclaredSeason':'2026','template':o['page'],'revision':o['revision'],'templateHash':o['expandedHtmlSha256'],'rootRevision':o['revision'],'expandedHtmlSha256':o['expandedHtmlSha256'],'observedAt':o['observedAt'],'rosterSourceObservedAt':o['observedAt'],'rosterPage':o['page']})
(root/'discovered.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf8')
summary={'rows':dict(collections.Counter(x['team'] for x in rows)),'usesExistingProfileCacheOnly':True,'noNba':True,'newIdsCreated':0};(out/'supplement-discovery-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf8');print(json.dumps(summary))
