"""Read-only evidence export; never modify the separate ingestion service."""
import csv, hashlib, io, json, sqlite3
from pathlib import Path
from datetime import datetime, timezone
root = Path(__file__).resolve().parents[1]
source = root.parent / 'docked-nfl-ingestion/data/nflverse.sqlite'
out = root / 'private-data/nfl-roster-reconciliation'
out.mkdir(parents=True, exist_ok=True)
with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as db:
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA query_only=ON')
    db.execute('BEGIN')
    cache = db.execute("select * from http_cache where url like '%/players/players.csv'").fetchone()
    body = cache['body']
    if isinstance(body, bytes): body = body.decode('utf-8-sig')
    rows = list(csv.DictReader(io.StringIO(body)))
    wanted = ['gsis_id','display_name','first_name','last_name','short_name','football_name','position','position_group','birth_date','college_name','college','height','weight','nfl_id','espn_id','pfr_id','status','latest_team']
    players = [{k:r.get(k) for k in wanted if k in r} for r in rows]
    identities = [dict(r) for r in db.execute("select m.canonical_id,m.external_id,e.name,e.position from mappings m join entities e on e.id=m.canonical_id where m.provider='nflverse' and m.kind='player'")]
    appearances = [dict(r) for r in db.execute("select r.player_id,g.season,g.season_type,count(*) appearances from records r join games g on g.id=r.game_id where r.removed=0 group by r.player_id,g.season,g.season_type")]
    meta = dict(db.execute("select key,value from meta where key in('dataset_id','schema_version')"))
    snapshot = {'at':datetime.now(timezone.utc).isoformat(),'source':str(source),'cache':{'url':cache['url'],'sha256':hashlib.sha256(body.encode()).hexdigest(),'fetchedAt':cache['fetched_at']},'columns':list(rows[0]),'players':players,'identities':identities,'appearances':appearances,'meta':meta}
    db.rollback()
(out/'source.json').write_text(json.dumps(snapshot),encoding='utf-8')
print(json.dumps({'players':len(players),'canonicalIdentities':len(identities),'appearanceGroups':len(appearances),'columns':list(rows[0])}))
