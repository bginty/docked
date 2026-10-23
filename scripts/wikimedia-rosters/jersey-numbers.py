"""Offline, conservative presentation overlay; never alters inventory or roster identity."""
import sys,json,re,hashlib,urllib.parse,collections
sys.path.insert(0,'private-data/roster-parser')
import mwparserfromhell as mw
root='private-data/roster-source-review/'
review=json.load(open(root+'review.json',encoding='utf8'))['players']
discovered=json.load(open(root+'discovered.json',encoding='utf8'))
pages={p['revisions'][0]['revid']:p for p in json.load(open(root+'profiles.json',encoding='utf8')) if p.get('revisions')}
catalog=json.load(open('public/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json',encoding='utf8'))
ids={p['rosterBeta']['wikidataId']:p['fixturePlayerId'] for p in catalog['players']}
output={};evidence=[];excluded=[]
for p in review:
 if p['sport']=='nrl':continue # No permanent shirt numbers in the reviewed roster contract.
 raw=pages[p['profileRevision']]['revisions'][0]['slots']['main']['content']
 assert hashlib.sha256(raw.encode()).hexdigest()==p['profileHash']
 inf=next(t for t in mw.parse(raw).filter_templates() if str(t.name).strip().lower().startswith('infobox'))
 key='number' if p['sport']=='basketball' else 'guernsey'
 n=str(inf.get(key).value).strip() if inf.has(key) else ''
 matches=[r for r in discovered if r['sport']==p['sport'] and r['team']==p['team'] and r['name']==p['name']]
 roster_numbers=set(str(r.get('number','')).strip() for r in matches)
 # Exact roster/profile agreement only. No career-number extraction, guessing or lost leading zero.
 if re.fullmatch(r'(?:[0-9]|[1-9][0-9]|00)',n) and roster_numbers=={n}:
  output[ids[p['wikidataId']]]={'sport':p['sport'],'team':p['team'],'number':n}
  evidence.append({'playerId':ids[p['wikidataId']],'name':p['name'],'number':n,'team':p['team'],'source':p['profileSource'],'rosterSource':p['rosterSource'],'profileHash':p['profileHash'],'profileRevision':p['profileRevision'],'rosterRevision':matches[0]['rosterRevision'],'license':'CC-BY-SA-4.0'})
 else:excluded.append({'name':p['name'],'sport':p['sport'],'reason':'Missing or conflicting roster/profile number'})
json.dump(output,open('config/roster-jersey-presentation-v1.json','w',encoding='utf8'),ensure_ascii=False,indent=2)
json.dump({'scope':'Presentation only; matching stable player, sport and team required. No NRL permanent numbers. No inventory writes.','license':'CC-BY-SA-4.0','attribution':'Wikipedia contributors; exact revisions recorded per player.','changes':'Extracted shirt numbers only when roster and profile agree.','counts':dict(collections.Counter(x['sport'] for x in output.values())),'evidence':evidence,'excluded':excluded},open('docs/qa/card-consistency/jersey-evidence.json','w',encoding='utf8'),ensure_ascii=False,indent=2)
print(collections.Counter(x['sport'] for x in output.values()),'unresolved',len(excluded))
