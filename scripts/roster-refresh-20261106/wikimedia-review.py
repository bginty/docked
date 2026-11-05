"""Review dated facts against existing UUIDs; no profile data beyond roster facts exported."""
import json,re,sys,hashlib,urllib.parse,collections,html
from pathlib import Path
sys.path.insert(0,'C:/Users/61412/.codex/worktrees/fixed-market-live/Docked.com.au/private-data/roster-parser')
import mwparserfromhell as mw
root=Path('private-data/roster-refresh-20261106/wikimedia');out=Path('docs/qa/roster-refresh-20261106/wikimedia')
oldpath=Path('public/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json')
oldraw=oldpath.read_bytes();old=json.loads(oldraw);known={(p['sport'],p['rosterBeta']['wikidataId']):p for p in old['players'] if p['sport'] in ('afl','nrl')}
sha=lambda x:hashlib.sha256(x.encode()).hexdigest()
def clean(v):
 v=re.sub(r'<ref\b[^>]*>.*?</ref>|<ref\b[^>]*/>|<!--.*?-->','',str(v),flags=re.S);c=mw.parse(v)
 for t in c.filter_templates():
  if str(t.name).strip().lower() in ['nowrap','nobr','small'] and t.has(1):c.replace(t,t.get(1).value)
 return ' '.join(c.strip_code().replace('\xa0',' ').split())
afl={'Adel':'Adelaide','Bri':'Brisbane Lions','Car':'Carlton','Coll':'Collingwood','Ess':'Essendon','Fre':'Fremantle','Geel':'Geelong','GC':'Gold Coast','GWS':'Greater Western Sydney','Haw':'Hawthorn','Mel':'Melbourne','NM':'North Melbourne','PA':'Port Adelaide','Rich':'Richmond','StK':'St Kilda','Syd':'Sydney','WC':'West Coast','WB':'Western Bulldogs','Ade':'Adelaide','BL':'Brisbane Lions','Col':'Collingwood','Gee':'Geelong','GCS':'Gold Coast','Por':'Port Adelaide','Ric':'Richmond','WCE':'West Coast','STK':'St Kilda','Stk':'St Kilda','ESS':'Essendon','MEL':'Melbourne','NMFC':'North Melbourne','SYD':'Sydney','FRE':'Fremantle'}
def team_value(v):
 for t in mw.parse(str(v)).filter_templates():
  n=str(t.name).strip();a=n[4:] if n.startswith('AFL ') else str(t.get(1).value).strip() if n=='AFL' and t.has(1) else None
  if a:return afl.get(a,a)
 return clean(v)
aliases_team={'Manly Warringah Sea Eagles':'Manly-Warringah Sea Eagles','Manly Sea Eagles':'Manly-Warringah Sea Eagles','The Dolphins':'Dolphins','Sydney Swans':'Sydney','Adelaide Crows':'Adelaide','Geelong Cats':'Geelong','Gold Coast Suns':'Gold Coast','GWS Giants':'Greater Western Sydney','Greater Western Sydney Giants':'Greater Western Sydney','West Coast Eagles':'West Coast','South Sydney':'South Sydney Rabbitohs','Cronulla Sharks':'Cronulla-Sutherland Sharks','Canterbury Bulldogs':'Canterbury-Bankstown Bulldogs','St. George Illawarra':'St. George Illawarra Dragons','North Qld Cowboys':'North Queensland Cowboys','Nth Qld Cowboys':'North Queensland Cowboys'}
def norm(v):return re.sub(r'[^a-z0-9]','',aliases_team.get(v,v).lower().replace('football club','').replace('fc',''))
nrlpos={'FB':'WFB','WG':'WFB','CE':'CTR','FE':'HLF','HB':'HLF','SR':'EDG','PR':'MID','LK':'MID'}
supplement=sys.argv[1:]==['--supplement']
assert not sys.argv[1:] or supplement
input_dir=root/'supplement' if supplement else root
rows=json.loads((input_dir/'discovered.json').read_text(encoding='utf8'));template_doc=json.loads((root/'team-templates.json').read_text(encoding='utf8'))
rawteams={p['title']:p['revisions'][0]['slots']['main']['content'] for p in template_doc['query']['pages']}
requests=json.loads((out/'profile-requests.json').read_text(encoding='utf8'))
if not supplement:assert sum(r['requested'] for r in requests)==len({r['sourceTitle'] for r in rows}), 'Complete fresh profile observation required'
pages={};aliases={}
for f in sorted((root/'profiles').glob('batch-*.json')):
 d=json.loads(f.read_text(encoding='utf8'))
 for k in ('normalized','redirects'):aliases.update({r['from']:r['to'] for r in d['query'].get(k,[])})
 for p in d['query']['pages']:pages[p['title']]=(p,d['docked'])
canonical={(p['sport'],norm(p['currentTeam'])):p['currentTeam'] for p in known.values()}
accepted=[];held=[]
for r in rows:
 sport=r['sport'];title=r['sourceTitle'];seen=set();reasons=[]
 while title in aliases and title not in seen:seen.add(title);title=aliases[title]
 p,observation=pages.get(title,({},{}));rev=(p.get('revisions') or [None])[0];qid=p.get('pageprops',{}).get('wikibase_item');oldp=known.get((sport,qid));team=canonical.get((sport,norm(r['team'])));pos=[];current='';future=[];profile_number=None
 if r['sourceSeason']!='2026':reasons.append('FUTURE_OR_UNRESOLVED_SOURCE_SEASON')
 if not team:reasons.append('UNMAPPED_CLUB_ALIAS')
 if not rev:reasons.append('MISSING_PROFILE_REVISION')
 if not qid:reasons.append('MISSING_WIKIDATA_ID')
 elif oldp is None:reasons.append('NO_EXISTING_DOCKED_UUID')
 # Use fresh expanded roster facts plus the separately observed exact team template.
 # If the player's link and label both disappeared between observations, fail closed.
 if not supplement:
  raw=rawteams[r['template']].replace('_',' ').casefold()
  if r['sourceTitle'].casefold() not in raw and r['name'].casefold() not in raw:reasons.append('TEAM_TEMPLATE_LINK_CHANGED')
 if rev:
  content=rev['slots']['main']['content'];inf=next((t for t in mw.parse(content).filter_templates() if str(t.name).strip().lower().startswith('infobox')),None)
  if inf is None:reasons.append('MISSING_PLAYER_INFOBOX')
  else:
   f={str(x.name).strip():x.value for x in inf.params};rawpos=str(f.get('position',''));plain=clean(rawpos).lower()
   if clean(f.get('retired','')).lower()=='yes':reasons.append('RETIRED_PROFILE')
   if sport=='afl':
    if re.search(r'back|defen',plain):pos.append('DEF')
    if re.search(r'midfield|wing|rover|centreman',plain) or plain=='centre':pos.append('MID')
    if 'forward' in plain:pos.append('FWD')
    if re.search(r'ruckman|ruck\b(?![\s-]*rover)',plain):pos.append('RUC')
    current=team_value(f.get('current_club',f.get('currentclub','')));career_in_2026=False
    if f.get('currentclub') and f.get('current_club') and norm(team_value(f['currentclub']))!=norm(current):reasons.append('CONFLICTING_PROFILE_CURRENT_CLUB_FIELDS')
    number=clean(f.get('guernsey',''));profile_number=int(number) if re.fullmatch(r'\d{1,2}',number) else None
    for key,val in f.items():
     m=re.fullmatch(r'club(\d+)',key)
     if not m or norm(team_value(val))!=norm(r['team']):continue
     years_text=html.unescape(clean(f.get('years'+m[1],'')));years=re.findall(r'20\d\d',years_text)
     if years and int(years[0])>2026:future.append(years[0])
     if years and int(years[0])<=2026 and (int(years[-1])>=2026 or re.search(r'(?:[-–—]|present)\s*$',years_text,re.I)):career_in_2026=True
    # Current personnel templates do not carry their own year. A changed AFL
    # team needs explicit matching 2026 profile career evidence, not merely a
    # currentclub edit that could reflect an announced 2027 transfer.
    if oldp and norm(oldp['currentTeam'])!=norm(r['team']) and not career_in_2026:reasons.append('AFL_TRANSFER_SEASON_NOT_CONFIRMED')
   else:
    terms=[str(v.value).strip().upper() for t in mw.parse(rawpos).filter_templates() if str(t.name).strip().lower()=='rlp' for v in t.params]
    listed={nrlpos[x] for x in re.findall(r'\b(?:FB|WG|CE|FE|HB|SR|PR|LK)\b',r['rosterPosition'] or '')};pos=list(dict.fromkeys(nrlpos[x] for x in terms if x in nrlpos and nrlpos[x] in listed));clubs=[]
    for key,val in f.items():
     m=re.fullmatch(r'club(\d+)',key)
     if not m:continue
     start=re.match(r'^20\d\d',clean(f.get('year'+m[1]+'start','')));club=team_value(val)
     if not start:continue
     if int(start[0])>2026 and norm(club)==norm(r['team']):future.append(start[0])
     if int(start[0])<=2026 and clean(f.get('year'+m[1]+'end','')).lower() in ('present',''):clubs.append((int(start[0]),int(m[1]),club))
    current=max(clubs)[2] if clubs else ''
   if future:reasons.append('PROFILE_CLUB_STARTS_IN_FUTURE_SEASON')
   if not pos:reasons.append('NO_SUPPORTED_PROFILE_ROSTER_POSITION')
   if not current or norm(current)!=norm(r['team']):reasons.append('PROFILE_ROSTER_CLUB_CONFLICT')
 evidence={'sport':sport,'name':r['name'],'team':team or r['team'],'wikidataId':qid,'existingId':oldp['fixturePlayerId'] if oldp else None,'sourceSeason':r['sourceSeason'],'rootDeclaredSeason':r['rootDeclaredSeason'],'teamDeclaredSeason':r['teamDeclaredSeason'],'sourceTitle':title,'rosterTemplate':r['template'],'rosterTemplateRevision':r['revision'],'rosterTemplateSha256':r['templateHash'],'rosterRootRevision':r['rootRevision'],'rosterExpandedSha256':r['expandedHtmlSha256'],'rosterObservedAt':r['rosterSourceObservedAt'],'teamObservedAt':r['observedAt'],'profileRevision':rev['revid'] if rev else None,'profileRevisionTimestamp':rev['timestamp'] if rev else None,'profileObservedAt':observation.get('observedAt'),'profileSha256':sha(content) if rev else None,'profileSource':('https://en.wikipedia.org/w/index.php?title='+urllib.parse.quote(title.replace(' ','_'))+'&oldid='+str(rev['revid'])) if rev else None,'positions':pos,'rosterJerseyNumber':r['number'],'profileClub':current,'profileJerseyNumber':profile_number,'futureClubYears':future}
 if supplement:evidence={'sourceContext':r['sourceContext'],**evidence}
 if reasons:held.append({**evidence,'reasons':reasons});continue
 accepted.append(evidence)
counts=collections.Counter(x['existingId'] for x in accepted);duplicates=[x for x in accepted if counts[x['existingId']]>1];accepted=[x for x in accepted if counts[x['existingId']]==1];held.extend({**x,'reasons':['DUPLICATE_CURRENT_IDENTITY']} for x in duplicates)
assert all(x['existingId'] and x['sourceSeason']=='2026' and x['positions'] and x['profileRevision'] for x in accepted)
assert len({x['existingId'] for x in accepted})==len(accepted)
review={'snapshot':'wikimedia-nrl-2026-squad-supplement-2026-11-06-v1' if supplement else 'wikimedia-afl-nrl-factual-2026-11-06-v1','baseSnapshotSha256':hashlib.sha256(oldraw).hexdigest(),'accepted':accepted,'held':held,'permanentIssuanceApproved':False,'newIdsCreated':0}
(input_dir/'review.json').write_text(json.dumps(review,ensure_ascii=False,indent=2),encoding='utf8')
summary={'accepted':dict(collections.Counter(x['sport'] for x in accepted)),'held':dict(collections.Counter(x['sport'] for x in held)),'holdsByReason':dict(collections.Counter(x['sport']+':'+r for x in held for r in x['reasons'])),'acceptedTeams':{s:len(set(x['team'] for x in accepted if x['sport']==s)) for s in ['afl','nrl']},'futureTemplateRowsHeld':sum(x['teamDeclaredSeason']=='2027' for x in held),'newIdsCreated':0,'permanentIssuanceApproved':False}
(out/('supplement-review-summary.json' if supplement else 'review-summary.json')).write_text(json.dumps(summary,indent=2),encoding='utf8');print(json.dumps(summary))
