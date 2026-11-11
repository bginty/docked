"""Offline comparison of freshly fetched evidence. Never changes a catalogue."""
import collections, datetime, hashlib, json, pathlib, re, unicodedata

root = pathlib.Path('private-data/v31-card-research-20261111')
out = pathlib.Path('docs/qa/v31-prelaunch-20261111/cards')
def read(path): return json.loads(pathlib.Path(path).read_text(encoding='utf8'))
def norm(value): return re.sub('[^a-z0-9]', '', unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode().lower())
def team(value):
    aliases = {'LA':'LAR','Sydney Swans':'Sydney','Adelaide Crows':'Adelaide','Geelong Cats':'Geelong','Gold Coast Suns':'Gold Coast','GWS Giants':'Greater Western Sydney','West Coast Eagles':'West Coast','Manly Warringah Sea Eagles':'Manly-Warringah Sea Eagles','Manly Sea Eagles':'Manly-Warringah Sea Eagles','The Dolphins':'Dolphins','South Sydney':'South Sydney Rabbitohs','Cronulla Sharks':'Cronulla-Sutherland Sharks','Canterbury Bulldogs':'Canterbury-Bankstown Bulldogs','St. George Illawarra':'St. George Illawarra Dragons','North Qld Cowboys':'North Queensland Cowboys','Nth Qld Cowboys':'North Queensland Cowboys'}
    return norm(aliases.get(value, value))
candidate = read('private-data/commercial-pool-20261106-v2/candidate.private.json')
proposal = read(root/'complete-proposal.private.json')
nfl = read(root/'current-nfl/official-rosters.json')
aus = read(root/'current-australian/review.json')
profiles = read(root/'current-australian/profiles.json')
aflRoot = read(root/'current-australian/afl.json')
nrlRoot = read(root/'current-australian/nrl.json')
assert len(nfl) == 32 and all(t['status']=='parsed-review-required' for t in nfl)
players = {}
for r in candidate['rows']:
    p = players.setdefault(r['player_id'], {'row':r,'definitionIds':[]})
    p['definitionIds'].append(r['id'])
assert len(players)==1293
records=[]
for pid,p in players.items():
    r=p['row']; s=r['snapshot']; reasons=[]; observations=[]
    if r['sport']=='nfl':
        for t in nfl:
            for x in t['players']:
                if norm(x['name'])==norm(s['name']):
                    observations.append({'team':t['team'],'position':x['position'],'section':x['section'],'url':t['url'],'sha256':t['sha256'],'checkedAt':t['checkedAt']})
        matching=[x for x in observations if team(x['team'])==team(s['team']) and (x['position']==s['position'] or (s['position']=='RB' and x['position'] in ['FB','HB'])) and x['section']=='Active']
        if len(matching)!=1: reasons.append('Requires current official membership/position review; absence is not proof of retirement')
        else: observations=matching
    else:
        matching=[x for x in aus['players'] if x['sport']==r['sport'] and r['sport']+':'+x['wikidataId']==s['providerId']]
        rootDoc=aflRoot if r['sport']=='afl' else nrlRoot
        for x in matching:
            observations.append({'team':x['team'],'positions':x['positions'],'season':x['season'],'url':x['profileSource'],'profileSha256':x['profileHash'],'rosterUrl':x['rosterSource'],'rosterRevision':rootDoc['parse']['revid'],'rosterPayloadSha256':hashlib.sha256(rootDoc['parse']['text'].encode()).hexdigest(),'checkedAt':rootDoc['docked']['fetchedAt'],'sourceUpdatedAt':x['sourceUpdatedAt'],'license':x['license']})
        if len(matching)!=1:
            reasons.append('No unique current roster/profile agreement for the existing stable Wikidata identity')
            qid=s['providerId'].split(':')[-1]
            titles={norm(x['title']) for x in profiles if x.get('pageprops',{}).get('wikibase_item')==qid}
            rejected=[x for x in aus['rejected'] if x['sport']==r['sport'] and (norm(x.get('profile',x['sourceTitle'])) in titles or norm(x['name'])==norm(s['name']))]
            observations.extend({'review':'quarantined; does not authorize new issuance','rosterTeam':x['team'],'rosterSeason':x['season'],'reasons':x['reasons'],'rosterUrl':'https://en.wikipedia.org/wiki/'+x['rosterPage'].replace(' ','_'),'checkedAt':rootDoc['docked']['fetchedAt']} for x in rejected)
        elif team(matching[0]['team'])!=team(s['team']): reasons.append('Current team differs from pinned snapshot; preserve issued metadata and review new-issuance scope')
        elif s['position'] not in matching[0]['positions'] or not set(s['eligiblePositions']).issubset(matching[0]['positions']): reasons.append('Current position evidence differs; no silent position expansion')
        elif matching[0]['season']!=s['season']: reasons.append('Current season differs; separate season approval required')
    records.append({'playerId':pid,'sport':r['sport'],'provider':s['provider'],'providerId':s['providerId'],'name':s['name'],'pinnedTeam':s['team'],'pinnedPosition':s['position'],'pinnedSeason':s['season'],'definitionIds':sorted(p['definitionIds']),'result':'CURRENT_FACTS_MATCH_PINNED_METADATA' if not reasons else 'HOLD_FROM_NEW_ISSUANCE','reasons':reasons,'observations':observations,'currentEligibilityApproved':False,'rightsApproved':False})
records.sort(key=lambda r:(r['sport'],r['providerId']))
counts={sport:dict(collections.Counter(r['result'] for r in records if r['sport']==sport)) for sport in ['nfl','afl','nrl']}
held_groups={sport:dict(collections.Counter(reason for r in records if r['sport']==sport and r['reasons'] for reason in set(y for observation in r['observations'] for y in observation.get('reasons',[])))) for sport in ['nfl','afl','nrl']}
eligible=set(d for r in records if not r['reasons'] for d in r['definitionIds'])
supply=[]
for sport in ['nfl','afl','nrl']:
    for rarity in ['RARE','ELITE','ULTRA_RARE','LEGENDARY','ICON']:
        rows=[r for r in proposal['rows'] if r['id'] in eligible and r['sport']==sport and r['rarity']==rarity]
        supply.append({'sport':sport,'rarity':rarity,'definitions':len(rows),'consumedLifetimeCopies':sum(r['legacy_issued'] for r in rows),'hypotheticalRemainingLifetimeCapacity':sum(r['lifetime_cap']-r['issued'] for r in rows),'playersWithCapacity':sum(r['issued']<r['lifetime_cap'] for r in rows),'saleableNow':0})
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'productionWrites':0,'publishedDatasetChanged':False,'existingMetadataChanged':False,'basePlayersReviewed':1293,'baseDefinitionsReviewed':6465,'counts':counts,'additionalHeldReasonCountsMayOverlap':held_groups,'matchingPlayers':sum(not r['reasons'] for r in records),'heldPlayers':sum(bool(r['reasons']) for r in records),'matchingDefinitionIds':sorted(eligible),'matchingDefinitions':len(eligible),'historicalAdditionalDefinitionsHeld':75,'hypotheticalSupplyAfterSeparateEligibilityAndRightsApproval':supply,'sourceFreshnessHours':72,'records':records,'notes':['Fresh retrieval does not confer rights, current eligibility approval or permission to change teams/seasons.','The historical proposal retains original snapshot timestamps. This evidence is a separate current-eligibility comparison, not an overwrite or automatic approval.','All 6540 definitions remain unapproved; saleable inventory is zero. Mint-on-purchase consumes lifetime capacity; no warehouse stock-load quantity is required.','Current NRL squad templates include 2027 teams; existing season policy quarantines these rather than silently promoting 2026 cards.']}
out.joinpath('current-source-comparison.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k not in ['records','matchingDefinitionIds','hypotheticalSupplyAfterSeparateEligibilityAndRightsApproval']}))
