import json,sys,re,hashlib,collections,glob,urllib.parse
sys.path.insert(0,'private-data/roster-parser')
import mwparserfromhell as mw
from roster_fields import explicit_current_club
root=(sys.argv[1].rstrip('/')+'/' if len(sys.argv)>1 else 'private-data/roster-source-review/')
rows=json.load(open(root+'discovered.json',encoding='utf8'))
pages={p['title']:p for p in json.load(open(root+'profiles.json',encoding='utf8'))}
aliases={}
for file in glob.glob(root+'profiles/batch-*.json'):
 d=json.load(open(file,encoding='utf8'))
 for kind in ['normalized','redirects']:
  aliases.update({r['from']:r['to'] for r in d['query'].get(kind,[])})
def clean(v):
 v=re.sub(r'<ref\b[^>]*>.*?</ref>|<ref\b[^>]*/>|<!--.*?-->','',str(v),flags=re.S)
 code=mw.parse(v)
 for t in code.filter_templates():
  if str(t.name).strip().lower() in ['nowrap','nobr','small'] and t.has(1):code.replace(t,t.get(1).value)
 return ' '.join(code.strip_code().replace('\xa0',' ').split())
afl={'Adel':'Adelaide','Bri':'Brisbane Lions','Car':'Carlton','Coll':'Collingwood','Ess':'Essendon','Fre':'Fremantle','Geel':'Geelong','GC':'Gold Coast','GWS':'Greater Western Sydney','Haw':'Hawthorn','Mel':'Melbourne','NM':'North Melbourne','PA':'Port Adelaide','Rich':'Richmond','StK':'St Kilda','Syd':'Sydney','WC':'West Coast','WB':'Western Bulldogs'}
afl.update({'Ade':'Adelaide','BL':'Brisbane Lions','Col':'Collingwood','Gee':'Geelong','GCS':'Gold Coast','Por':'Port Adelaide','Ric':'Richmond','WCE':'West Coast','STK':'St Kilda','Stk':'St Kilda','ESS':'Essendon','MEL':'Melbourne','NMFC':'North Melbourne','SYD':'Sydney','FRE':'Fremantle'})
def team_value(v):
 code=mw.parse(str(v))
 for t in code.filter_templates():
  n=str(t.name).strip(); a=n[4:] if n.startswith('AFL ') else str(t.get(1).value).strip() if n=='AFL' and t.has(1) else None
  if a:return afl.get(a,a)
 return clean(v)
def norm(v):return re.sub(r'[^a-z0-9]','',v.lower().replace('football club','').replace('fc',''))
nbapos={'point guard':'PG','shooting guard':'SG','small forward':'SF','power forward':'PF','center':'C','centre':'C'}
nrlpos={'FB':'WFB','WG':'WFB','CE':'CTR','FE':'HLF','HB':'HLF','SR':'EDG','PR':'MID','LK':'MID'}
accepted=[];rejected=[]
for r in rows:
 title=r['sourceTitle']
 for _ in range(5):title=aliases.get(title,title)
 p=pages.get(title)
 reasons=[]
 if not p or p.get('missing') or not p.get('revisions'):
  rejected.append(dict(**r,reasons=['No profile evidence']));continue
 q=p.get('pageprops',{}).get('wikibase_item')
 if not q:reasons.append('No stable Wikidata identity')
 content=p['revisions'][0]['slots']['main']['content']
 inf=next((t for t in mw.parse(content).filter_templates() if str(t.name).strip().lower().startswith('infobox')),None)
 if not inf:rejected.append(dict(**r,reasons=['No player infobox']));continue
 f={str(x.name).strip():x.value for x in inf.params}
 raw=str(f.get('position',''));plain=clean(raw).lower()
 pos=[];current=''
 if r['sport']=='basketball':
  pos=[code for label,code in nbapos.items() if label in plain];pos=list(dict.fromkeys(pos))
  current=team_value(f.get('team',''))
 elif r['sport']=='afl':
  if re.search(r'back|defen',plain):pos.append('DEF')
  if re.search(r'midfield|wing|rover|centreman',plain) or plain=='centre':pos.append('MID')
  if 'forward' in plain:pos.append('FWD')
  if re.search(r'ruckman|ruck\b(?![\s-]*rover)',plain):pos.append('RUC')
  # The AFL template renamed currentclub to current_club. Accept either explicit
  # field; conflicting simultaneous values stay quarantined rather than guessed.
  current,conflict=explicit_current_club(f,team_value,norm)
  if conflict:reasons.append('Conflicting current club fields')
 else:
  terms=[]
  for t in mw.parse(raw).filter_templates():
   if str(t.name).strip().lower()=='rlp':terms += [str(v.value).strip().upper() for v in t.params]
  pos=list(dict.fromkeys(nrlpos[x] for x in terms if x in nrlpos))
  listed=set(nrlpos[x] for x in re.findall(r'\b(?:FB|WG|CE|FE|HB|SR|PR|LK)\b',r['rosterPosition']) if x in nrlpos)
  pos=[x for x in pos if x in listed]
  # Require current professional club evidence, not a retired career list.
  clubs=[]
  for k,v in f.items():
   m=re.fullmatch(r'club(\d+)',k)
   if m and clean(f.get('year'+m[1]+'end','')).lower() in ['present',''] and re.match(r'^20\d\d',clean(f.get('year'+m[1]+'start',''))):clubs.append(team_value(v))
  current=clubs[-1] if clubs else ''
  if clean(f.get('retired','')).lower()=='yes':reasons.append('Retired profile')
  if r['season']!='2026':reasons.append('Future-season roster, current membership requires separate evidence')
 if not pos:reasons.append('No supported verified position')
 aliases_team={'Manly Warringah Sea Eagles':'Manly-Warringah Sea Eagles','Manly Sea Eagles':'Manly-Warringah Sea Eagles','The Dolphins':'Dolphins','Sydney Swans':'Sydney','Adelaide Crows':'Adelaide','Geelong Cats':'Geelong','Gold Coast Suns':'Gold Coast','GWS Giants':'Greater Western Sydney','West Coast Eagles':'West Coast','South Sydney':'South Sydney Rabbitohs','Cronulla Sharks':'Cronulla-Sutherland Sharks','Canterbury Bulldogs':'Canterbury-Bankstown Bulldogs','St. George Illawarra':'St. George Illawarra Dragons','North Qld Cowboys':'North Queensland Cowboys','Nth Qld Cowboys':'North Queensland Cowboys'}
 a=aliases_team.get(current,current);b=aliases_team.get(r['team'],r['team'])
 if not current or norm(a)!=norm(b):reasons.append('Roster/profile team conflict: '+current)
 if reasons:rejected.append(dict(**r,profile=title,profilePosition=raw,reasons=reasons));continue
 rev=p['revisions'][0]
 item={'id':f"{r['sport']}-wikidata-{q}",'sport':r['sport'],'name':clean(r['name']),'wikidataId':q,'team':r['team'],'positions':pos,'season':r['season'],'registration':r['registration'],'contractStatus':'not-independently-verified','availability':'unknown','jerseyNumber':None,'rosterStatus':'listed','rosterSource':'https://en.wikipedia.org/wiki/'+urllib.parse.quote(r['rosterPage'].replace(' ','_')),'profileSource':f'https://en.wikipedia.org/w/index.php?title={urllib.parse.quote(title.replace(" ","_"))}&oldid={rev["revid"]}','profileRevision':rev['revid'],'sourceUpdatedAt':rev['timestamp'],'profileHash':hashlib.sha256(content.encode()).hexdigest(),'license':'CC-BY-SA-4.0','verification':'roster-and-profile-agreement','permanentIssuanceEligible':False}
 accepted.append(item)
# Quarantine duplicate identity rather than selecting arbitrary membership.
counts=collections.Counter(x['id'] for x in accepted)
dupes=[x for x in accepted if counts[x['id']]>1]
accepted=[x for x in accepted if counts[x['id']]==1]
report={'players':accepted,'rejected':rejected,'duplicates':dupes}
json.dump(report,open(root+'review.json','w',encoding='utf8'),ensure_ascii=False,indent=2)
for s in ['basketball','afl','nrl']:
 a=[x for x in accepted if x['sport']==s]
 print(s,len(a),'teams',len(set(x['team'] for x in a)),'positions',collections.Counter(p for x in a for p in x['positions']))
 print('rejections',collections.Counter(reason for x in rejected if x['sport']==s for reason in x['reasons']).most_common(14))
