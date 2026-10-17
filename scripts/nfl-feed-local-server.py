"""Serve an isolated copy of the separate service's real snapshot. No worker or upstream requests.
Credentials arrive via the parent process environment and are never printed.
"""
import os, sys, sqlite3, json
from pathlib import Path
from wsgiref.simple_server import make_server

source = Path(__file__).resolve().parents[2] / 'docked-nfl-ingestion'
sys.path.insert(0, str(source))
from nflfeed.api import API
from nflfeed.db import Database
from nflfeed.model import Clock
from nflfeed.providers import NflverseProvider
from nflfeed.__main__ import BoundedServer, QuietHandler

target = Path(os.environ['DOCKED_FEED_COPY']).resolve()
target.parent.mkdir(parents=True, exist_ok=True)
with sqlite3.connect((source / 'data/nflverse.sqlite').as_uri() + '?mode=ro', uri=True) as original:
    with sqlite3.connect(target) as copy:
        original.backup(copy)
db = Database(target)
clock = Clock()
api = API(db, NflverseProvider(db, clock), clock,
          [os.environ['NFL_API_KEY']], [os.environ['DOCKED_LOCAL_ADMIN_KEY']], rate=10000)
server = make_server('127.0.0.1', 0, api, server_class=BoundedServer, handler_class=QuietHandler)
# Reviewed identity evidence stays outside the feed contract. Exact provider-ID
# equality is used only by the local verification harness, never a name join.
identity = db.rows("SELECT m.canonical_id,e.name,e.position,m.external_id FROM mappings m JOIN entities e ON e.id=m.canonical_id WHERE m.kind='player' AND m.provider='nflverse'")
Path(os.environ['DOCKED_FEED_READY']).write_text(json.dumps({'port':server.server_port,'identities':identity}), encoding='utf-8')
server.serve_forever()
