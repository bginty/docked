import sys,json,re,urllib.parse
sys.path.insert(0,'private-data/roster-parser')
from bs4 import BeautifulSoup
root='private-data/roster-source-review/'
out=[]
for key,file in [('nbaEast','nba-east-response.txt'),('nbaWest','nbaWest.json'),('afl','afl.json'),('nrl','nrl.json')]:
 d=json.load(open(root+file,encoding='utf8'));p=d['parse'];s=BeautifulSoup(p['text'],'html.parser')
 if key.startswith('nba'):
  for t in s.select('table.sortable'):
   heading=t.find_previous('h3');team=heading.get_text(' ',strip=True) if heading else '?'
   for tr in t.select('tr'):
    cells=tr.find_all('td',recursive=False)
    if len(cells)<3:continue
    a=next((a for a in cells[2].find_all('a') if a.get('href','').startswith('/wiki/') and not a.get('href','').startswith('/wiki/File:')),None)
    if not a:continue
    out.append(dict(sport='basketball',team=team,rosterPage=p['title'],rosterRevision=p['revid'],sourceTitle=urllib.parse.unquote(a['href'][6:]).replace('_',' '),name=a.get_text(' ',strip=True),rosterPosition=cells[0].get_text(' ',strip=True),number=cells[1].get_text(' ',strip=True),registration='two-way' if '(TW)' in cells[2].get_text() else 'listed',season='2026-27'))
 else:
  print(key,'tables',len(s.select('table.toccolours')))
  for t in s.select('table.toccolours'):
   if t.find_parent('table'):continue
   heading=t.find_previous('h2');team=heading.get_text(' ',strip=True) if heading else '?'
   rows=t.find_all('tr',recursive=False)
   if not rows:
    tbody=t.find('tbody',recursive=False);rows=tbody.find_all('tr',recursive=False) if tbody else []
   print('TEAM',team,'FIRST',t.get_text(' ',strip=True)[:180])
   # Player lists are before the coaching-staff column. Exclude nested coaching lists.
   for tr in rows:
    for td in tr.find_all('td',recursive=False):
     if re.search(r'coach|president|development squad',td.get_text(' ',strip=True)[:60],re.I):continue
     for li in td.select('li'):
      if li.find_parent('li'):continue
      txt=li.get_text(' ',strip=True)
      if key=='afl' and not re.match(r'^\d{1,2}\s',txt):continue
      if key=='nrl' and not re.search(r'[–—]\s*(?:FB|WG|CE|FE|HB|PR|HK|SR|LK)',txt):continue
      a=next((a for a in li.find_all('a') if a.get('href','').startswith('/wiki/') and not a.get('href','').startswith('/wiki/File:')),None)
      if not a:continue
      year=re.search(r'(202[6-9]) NRL season',t.get_text(' ',strip=True)[:100])
      out.append(dict(sport=key,team=team,rosterPage=p['title'],rosterRevision=p['revid'],sourceTitle=urllib.parse.unquote(a['href'][6:]).replace('_',' '),name=a.get_text(' ',strip=True),rosterPosition=txt.split('–')[-1].strip() if key=='nrl' else None,number=re.match(r'^\d{1,2}',txt)[0] if key=='afl' else None,registration='listed',season=year[1] if year else '2026'))
json.dump(out,open(root+'discovered.json','w',encoding='utf8'),ensure_ascii=False,indent=2)
print('TOTALS',[(s,len([r for r in out if r['sport']==s]),len(set(r['team'] for r in out if r['sport']==s))) for s in ['basketball','afl','nrl']])
