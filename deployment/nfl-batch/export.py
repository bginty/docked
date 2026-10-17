"""Deployment adapter for the SEPARATE nflfeed project; no server or upstream IO.
Run with --source pointing at that project. Export only a consistent SQLite copy.
The batch is private raw data; never commit/upload it to a public repository.
"""
import argparse
from contextlib import closing
import gzip
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import sqlite3
import sys
import tempfile
import time


def export(source, database, output, key, quiescent=False, audience='/api/testing/nfl/import'):
    if len(key) < 32 or output.exists() or output.with_suffix('.auth.json').exists():
        raise ValueError('Fresh output and a private batch key required')
    sys.path.insert(0, str(source))
    from nflfeed.api import API
    from nflfeed.db import Database
    from nflfeed.model import Clock
    from nflfeed.providers import NflverseProvider
    output.parent.mkdir(parents=True, exist_ok=True)
    wal = Path(str(database) + '-wal')
    before = None
    if quiescent:
        if wal.exists() and wal.stat().st_size:
            raise ValueError('Quiescent snapshot has active WAL')
        before = hashlib.sha256(database.read_bytes()).hexdigest()
    with tempfile.TemporaryDirectory(prefix='nfl-batch-', dir=output.parent) as work:
        snapshot = Path(work) / 'snapshot.sqlite'
        with closing(sqlite3.connect(database.as_uri() + '?mode=ro' + ('&immutable=1' if quiescent else ''), uri=True)) as original:
            with closing(sqlite3.connect(snapshot)) as copy:
                original.backup(copy)
                if copy.execute('pragma integrity_check').fetchone()[0] != 'ok':
                    raise ValueError('Snapshot integrity failed')
        if quiescent and ((wal.exists() and wal.stat().st_size) or hashlib.sha256(database.read_bytes()).hexdigest() != before):
            raise ValueError('Quiescent snapshot changed during backup')
        db, clock = Database(snapshot), Clock()
        if db.meta('provider') != 'nflverse':
            raise ValueError('Expected existing nflverse dataset')
        read_key, admin_key = secrets.token_hex(32), secrets.token_hex(32)
        api = API(db, NflverseProvider(db, clock), clock, [read_key], [admin_key], rate=10000)
        changes, cursor = [], None
        for _ in range(1000):
            page = api.changes({'limit': '200', **({'cursor': cursor} if cursor else {})})
            changes.append(page)
            cursor = page['next_cursor']
            if not page['has_more']:
                break
        else:
            raise ValueError('Batch capacity reached; do not truncate history')
        metadata = {}
        for kind in ('games', 'players'):
            items, after = [], None
            while True:
                status, page = api.dispatch('GET', '/v1/' + kind,
                    {'limit': '200', **({'after': after} if after else {})}, 'Bearer ' + read_key, {})
                if status != 200:
                    raise ValueError('Metadata export failed')
                items.extend(page['data'])
                after = page['next_after']
                if not after:
                    break
            metadata[kind] = api.envelope(items, next_after=None)
        # Labels come from the SAME consistent source snapshot and canonical
        # team identities, never a player-name guess or current roster join.
        teams = {r['id']: r['name'] for r in db.rows("SELECT id,name FROM entities WHERE kind='team'")}
        for game in metadata['games']['data']:
            for side in ('home', 'away'):
                name = teams.get(game.get(side + '_id'))
                if name:
                    game[side + '_name'] = name
        batch = {'batch_version': 'docked-raw-postgame-batch-v1',
                 'exported_at': time.time(), 'dataset_id': db.meta('dataset_id'),
                 'changes': changes, **metadata}
        raw = json.dumps(batch, separators=(',', ':'), ensure_ascii=False).encode()
        body = gzip.compress(raw, mtime=0)
        if len(raw) > 64_000_000 or len(body) > 2_000_000:
            raise ValueError(f'Batch exceeds bounded transport ({len(raw)} raw / {len(body)} compressed bytes); never truncate')
        timestamp = str(int(time.time()))
        signature = hmac.new(key.encode(), audience.encode() + b'\n' + timestamp.encode() + b'\n' + body, hashlib.sha256).hexdigest()
        output.write_bytes(body)
        output.with_suffix('.auth.json').write_text(json.dumps({'timestamp': timestamp, 'signature': signature}))
        return {'dataset': batch['dataset_id'], 'events': sum(len(p['data']) for p in changes),
                'games': len(metadata['games']['data']), 'players': len(metadata['players']['data']),
                'compressedBytes': len(body), 'rawBytes': len(raw),
                'sha256': hashlib.sha256(body).hexdigest(), 'sourceModified': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True)
    parser.add_argument('--database', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--quiescent-snapshot', action='store_true', help='Only an already stopped, checkpointed source/backup')
    args = parser.parse_args()
    try:
        print(json.dumps(export(Path(args.source).resolve(), Path(args.database).resolve(),
                                Path(args.output).resolve(), os.environ.get('NFL_BATCH_KEY', ''), args.quiescent_snapshot)))
    except Exception:
        print('Batch export failed; inspect local configuration. No credentials logged.', file=sys.stderr)
        sys.exit(1)
