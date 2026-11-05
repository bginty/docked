"""Dated AFL/NRL discovery; old published dataset and NBA are never input requests."""
import json,re,sys,hashlib,urllib.parse,collections
from pathlib import Path
sys.path.insert(0,'C:/Users/61412/.codex/worktrees/fixed-market-live/Docked.com.au/private-data/roster-parser')
from bs4 import BeautifulSoup
import mwparserfromhell as mw
root=Path('private-data/roster-refresh-20261106/wikimedia');out=Path('docs/qa/roster-refresh-20261106/wikimedia')
templates=json.loads((root/'team-templates.json').read_text(encoding='utf8'))
bytitle={p['title']:p for p in templates['query']['pages']}
rows=[];teammeta=[]
for sport in ['afl','nrl']:
 d=json.loads((root/(sport+'-current.json')).read_text(encoding='utf8'));p=d['parse'];s=BeautifulSoup(p['text'],'html.parser')
 intro=s.get_text(' ',strip=True).split('[ edit')[0];rootyear=re.search(r'202\d',intro[:200]);rootyear=rootyear[0] if rootyear else None
 for table in s.select('table.toccolours'):
  if table.find_parent('table'):continue
  heading=table.find_previous('h2');team=heading.get_text(' ',strip=True) if heading else '?'
  template=None
  for a in table.find_all('a'):
   q=urllib.parse.parse_qs(urllib.parse.urlparse(a.get('href','')).query)
   candidate=q.get('title',[''])[0].replace('_',' ')
   if not candidate and a.get('href','').startswith('/wiki/Template:'):candidate=urllib.parse.unquote(a['href'][6:]).replace('_',' ')
   if candidate in bytitle and (candidate.endswith(' AFL personnel') or candidate.endswith(' current squad')):template=bytitle[candidate];break
  if template is None:raise RuntimeError('No exact fetched team template for '+sport+':'+team)
  rev=template['revisions'][0];content=rev['slots']['main']['content'];outer=mw.parse(content).filter_templates()[0]
  squadname=str(outer.get('squadname').value) if outer.has('squadname') else ''
  explicit=re.search(r'202\d',squadname);season=explicit[0] if explicit else rootyear
  actual={'sport':sport,'team':team,'rootDeclaredSeason':rootyear,'teamDeclaredSeason':explicit[0] if explicit else None,'sourceSeason':season,'template':template['title'],'revision':rev['revid'],'revisionTimestamp':rev['timestamp'],'templateHash':hashlib.sha256(content.encode()).hexdigest(),'observedAt':templates['docked']['observedAt'],'rootRevision':p['revid'],'expandedHtmlSha256':d['docked']['expandedHtmlSha256'],'rosterSourceObservedAt':d['docked']['observedAt']}
  teammeta.append(actual)
  for li in table.select('li'):
   if li.find_parent('li'):continue
   txt=li.get_text(' ',strip=True)
   if sport=='afl' and not re.match(r'^\d{1,2}\s',txt):continue
   if sport=='nrl' and not re.search(r'[–—]\s*(?:FB|WG|CE|FE|HB|PR|HK|SR|LK)',txt):continue
   a=next((a for a in li.find_all('a') if a.get('href','').startswith('/wiki/') and not a.get('href','').startswith('/wiki/File:')),None)
   if a is None:continue
   title=urllib.parse.unquote(a['href'][6:]).replace('_',' ')
   if not title:continue
   raw_positions=re.split(r'[–—]',txt)[-1].strip() if sport=='nrl' else None
   number=re.match(r'^\d{1,2}',txt) if sport=='afl' else None
   rows.append({**actual,'sourceTitle':title,'name':a.get_text(' ',strip=True),'rosterPosition':raw_positions,'number':number[0] if number else None,'registration':'listed','rosterPage':p['title'],'rosterRevision':p['revid']})
(root/'discovered.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf8')
(out/'team-source-seasons.json').write_text(json.dumps(teammeta,ensure_ascii=False,indent=2),encoding='utf8')
summary={'discovered':dict(collections.Counter(x['sport'] for x in rows)),'teams':dict(collections.Counter(x['sport'] for x in teammeta)),'teamSeasons':dict(collections.Counter(x['sport']+':'+str(x['sourceSeason']) for x in teammeta)),'noNba':True,'newIdsCreated':0}
(out/'discovery-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf8');print(json.dumps(summary))
