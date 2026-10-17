"""Manual or OS-scheduled outbound-only job. Does not install a scheduled task.
Source remains a separate project; persistent SQLite stays on this machine.
"""
import argparse
import hashlib
import hmac
import json
import os
from pathlib import Path
import subprocess
import sqlite3
from contextlib import closing
import sys
import time
import urllib.error
import urllib.request
from export import export

ROOT = Path(__file__).resolve().parents[2]

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True)
    parser.add_argument('--database', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--refresh', action='store_true', help='Run existing postgame worker until due queue drains (15 minute bound)')
    parser.add_argument('--push', action='store_true', help='Deliver to the explicitly approved target; no local inbound access')
    parser.add_argument('--live-history', action='store_true', help='Owner-approved live player history only; never competition settlement')
    args = parser.parse_args()
    source, database, output = (Path(x).resolve() for x in (args.source, args.database, args.output))
    permit = json.loads((ROOT / ('config/nfl-history.json' if args.live_history else 'config/nfl-postgame-permit.json')).read_text())
    from datetime import datetime
    permitted = (permit.get('scope') == 'member-player-history-only' and permit.get('approved') is True and permit.get('competitionSettlement') is False) if args.live_history else (permit.get('scope') == 'isolated-free-beta' and permit.get('enabled') is True)
    if not permitted or datetime.fromisoformat(permit['reviewExpiresAt' if args.live_history else 'expiresAt'].replace('Z','+00:00')).timestamp() <= time.time():
        raise ValueError('Testing source permit expired or unavailable')
    key = os.environ.get('NFL_HISTORY_BATCH_KEY' if args.live_history else 'NFL_BATCH_KEY', '')
    if len(key) < 32:
        raise ValueError('Private batch key required')
    binding = permit if args.live_history else json.loads((ROOT / 'config/nfl-hosted-testing.json').read_text())
    origin = 'https://docked.com.au' if args.live_history else 'https://docked-preview-s24-briant-ginty.vercel.app'
    audience = '/api/nfl/history/import' if args.live_history else '/api/testing/nfl/import'
    if args.push and args.live_history and (binding.get('origin') != origin or binding.get('projectRef') != 'pojoymtniryarxxunyvz' or binding.get('audience') != audience):
        raise ValueError('Exact live history target required')
    if args.push and not args.live_history and (binding.get('approved') is not True or binding.get('transport') != 'signed-batch' or
        not binding.get('approvalReference') or binding.get('projectRef') in (None, 'pojoymtniryarxxunyvz') or
        binding.get('batchImportOrigin') != origin or not os.environ.get('VERCEL_AUTOMATION_BYPASS_SECRET')):
        raise ValueError('Approved isolated target and protected access required')
    if args.refresh:
        output.parent.mkdir(parents=True, exist_ok=True)
        backup = output.with_suffix('.before.sqlite')
        if backup.exists():
            raise ValueError('Fresh backup destination required')
        with closing(sqlite3.connect(database.as_uri()+'?mode=ro',uri=True)) as original, closing(sqlite3.connect(backup)) as destination:
            original.backup(destination)
            if destination.execute('pragma integrity_check').fetchone()[0] != 'ok':
                raise ValueError('Recovery snapshot failed')
        backup.with_suffix('.sha256').write_text(hashlib.sha256(backup.read_bytes()).hexdigest())
        # A worker has no reason to receive transport/protection credentials.
        env = {k:v for k,v in os.environ.items() if k in ('PATH','SystemRoot','WINDIR','TEMP','TMP','HOME','USERPROFILE')}
        env.update(NFL_PROVIDER='nflverse', NFL_DB=str(database), NFL_SEASON='2026', NFL_CONCURRENCY='1')
        refresh_started = time.time()
        # Reset only the existing schedule and postgame correction sweep. No
        # listener or scheduled task is created. Worker stays in its own repo.
        with closing(sqlite3.connect(database)) as queue:
            if queue.execute("select count(*) from jobs where state='running' and lease_until>?", (refresh_started,)).fetchone()[0]:
                raise ValueError('Another source worker is active')
            for job_id, kind in [('schedule','schedule'), ('weekly','weekly')]:
                queue.execute("insert or ignore into jobs(id,kind,payload,due) values(?,?,?,?)", (job_id,kind,'{}',refresh_started))
                queue.execute("update jobs set state='pending',due=?,attempts=0,last_error=null where id=?", (refresh_started,job_id))
            # The worker deduplicates weekly sweep IDs. Reset this week's
            # existing sweep so two manual refreshes can pick up corrections.
            weekly_bucket = int(refresh_started // 604800)
            queue.execute("update jobs set state='pending',due=?,attempts=0,last_error=null where kind='game' and id like ? and json_extract(payload,'$.game_id') in(select id from games where season=2026 and status='final')", (refresh_started, 'sweep:%:'+str(weekly_bucket)))
            queue.commit()
        subprocess.run([sys.executable,'-m','nflfeed','worker','--drain'],cwd=source,env=env,
            check=True,timeout=900,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        with closing(sqlite3.connect(database.as_uri()+'?mode=ro',uri=True)) as checked:
            failures = checked.execute("select count(*) from jobs where last_error is not null and state='pending'").fetchone()[0]
            completed = checked.execute('select count(*) from jobs where completed_at>=?', (refresh_started,)).fetchone()[0]
            print(json.dumps({'sourceRefreshCompletedJobs':completed,'sourcePendingFailures':failures}))
            if failures or not completed:
                raise ValueError('Source refresh incomplete; publication not attempted')
    result = export(source,database,output,key,audience=audience)
    if not args.push:
        print(json.dumps({**result,'delivered':False}))
        return
    body = output.read_bytes()
    # Retries must reuse exact bytes; importer commits page/cursor atomically.
    for attempt in range(3):
        try:
            timestamp = str(int(time.time()))
            signature = hmac.new(key.encode(), audience.encode()+b'\n'+timestamp.encode()+b'\n'+body, hashlib.sha256).hexdigest()
            request = urllib.request.Request(origin+audience,data=body,method='POST',headers={
                'Content-Type':'application/octet-stream', 'x-nfl-timestamp':timestamp,
                'x-nfl-signature':signature, **({'x-vercel-protection-bypass':os.environ['VERCEL_AUTOMATION_BYPASS_SECRET']} if not args.live_history else {})})
            with urllib.request.build_opener(NoRedirect).open(request,timeout=310) as response:
                receipt = json.loads(response.read(16384))
                if response.status != 200 or receipt.get('digest') != hashlib.sha256(body).hexdigest():
                    raise ValueError('Unverified receipt')
                output.with_suffix('.receipt.json').write_text(json.dumps(receipt))
                print(json.dumps({**result,'delivered':True,'target':origin,'scope':'player history only' if args.live_history else 'isolated testing'}))
                return
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)

if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Postgame job incomplete; preserve the spool and inspect source jobs and receiver health. No successful publication is confirmed. No credentials logged.',file=sys.stderr)
        sys.exit(1)
