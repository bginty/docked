"""Public factual identity research only. No database or customer-data writes.

Raw provider material stays in ignored private-data; the public report contains
only exact identity matches, factual metadata, URLs and content hashes. Current
roster status is deliberately not converted into commercial issuance approval.
"""
import concurrent.futures
import csv
import hashlib
import html
import io
import json
import re
import unicodedata
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "private-data/v31-card-research-20261111"
OUT = ROOT / "docs/qa/v31-prelaunch-20261111/cards"
RAW.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
DECISIONS = json.loads((ROOT / "docs/qa/v31-operational-acceptance-20261110/card-founder-decisions.json").read_text(encoding="utf-8"))
CENSUS = json.loads((ROOT / "private-data/v31-final-reconciliation-20261110/census.private.json").read_text(encoding="utf-8"))
PLAYERS = "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv"

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Docked-Source-Readiness/1.0"})
    with urllib.request.urlopen(req, timeout=40) as response:
        body = response.read()
    return body

def normal(value):
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower())

def text(body):
    source = body.decode("utf-8", "replace")
    source = re.sub(r"<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>", " ", source, flags=re.S | re.I)
    return html.unescape(re.sub(r"<[^>]+>", " ", source))

def public_witness(url):
    at = datetime.now(timezone.utc).isoformat()
    try:
        body = fetch(url)
        sha = hashlib.sha256(body).hexdigest()
        (RAW / (sha + ".html")).write_bytes(body)
        return {"url": url, "checkedAt": at, "sha256": sha, "available": True}, normal(text(body))
    except Exception as exc:
        return {"url": url, "checkedAt": at, "available": False, "failureType": type(exc).__name__}, ""

# Keep a captured dataset immutable on subsequent offline proposal rebuilds.
capture = RAW / "selected-players.json"
if capture.exists():
    player_capture = json.loads(capture.read_text(encoding="utf-8"))
    body = (RAW / "players.csv").read_bytes()
    assert hashlib.sha256(body).hexdigest() == player_capture["sha256"]
else:
    body = fetch(PLAYERS)
    (RAW / "players.csv").write_bytes(body)
    all_players = list(csv.DictReader(io.StringIO(body.decode("utf-8-sig"))))
    ids = {r["providerId"] for r in DECISIONS["records"] if r["sport"] == "nfl"}
    player_capture = {"url": PLAYERS, "checkedAt": datetime.now(timezone.utc).isoformat(), "sha256": hashlib.sha256(body).hexdigest(), "rows": [r for r in all_players if r["gsis_id"] in ids]}
    capture.write_text(json.dumps(player_capture, indent=2) + "\n")

all_players = list(csv.DictReader(io.StringIO(body.decode("utf-8-sig"))))
index = {}
for row in all_players:
    index.setdefault(row["gsis_id"], []).append(row)

afl_sources = {
    "afl:Q107491321": [
        "https://www.goldcoastfc.com.au/news/1915963/ugle-hagan-to-play-for-the-gold-coast-suns-in-2026",
        "https://www.afl.com.au/news/1636548/amp/"],
    "afl:Q111831570": [
        "https://www.saints.com.au/news/1690507/saints-welcome-jack-carroll",
        "https://www.afl.com.au/news/1634437/former-carlton-blue-jack-carroll-axed-by-st-kilda-saints-after-two-seasons"],
    "afl:Q16233497": ["https://www.sydneyswans.com.au/news/2158471/dane-rampe-calls-time"],
    "afl:Q18580425": ["https://www.saints.com.au/afl/squad"],
    "afl:Q98690875": ["https://www.saints.com.au/afl/squad"],
}
urls = sorted({r["evidence"]["sourceUrl"] for r in DECISIONS["records"] if r["sport"] == "nfl"} | {u for group in afl_sources.values() for u in group})
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    witnesses = dict(zip(urls, pool.map(public_witness, urls)))

records = []
for record in DECISIONS["records"]:
    preserved = next(r["player"] for r in CENSUS["records"] if r.get("player", {}).get("providerId") == record["providerId"] and r["player"]["sport"] == record["sport"])
    result = {"sport": record["sport"], "name": record["player"], "provider": record["provider"], "providerId": record["providerId"], "existingCatalogueId": record["proposedCanonicalPlayerId"], "issuedCopies": len(record["allocations"]), "preservedSnapshot": {k: preserved[k] for k in ("name", "currentTeam", "position", "status")}, "historicalEvidence": record["evidence"], "newIssuanceEligible": False}
    if record["sport"] == "nfl":
        matched = index.get(record["providerId"], [])
        result["exactProviderMatches"] = len(matched)
        assert len(matched) == 1, "Ambiguous/missing GSIS identity must not be inferred"
        player = matched[0]
        assert normal(record["player"]) == normal(player["display_name"]), "Name contradiction must be reviewed"
        result["providerEvidence"] = {"url": PLAYERS, "sha256": player_capture["sha256"], "checkedAt": player_capture["checkedAt"], "gsisId": player["gsis_id"], "name": player["display_name"], "position": player["position"], "latestTeam": player["latest_team"], "rookieSeason": player["rookie_season"], "lastSeason": player["last_season"], "nflId": player["nfl_id"]}
        src, visible = witnesses[record["evidence"]["sourceUrl"]]
        result["officialRosterRecheck"] = {**src, "namePresentInPage": normal(record["player"]) in visible}
        team = {"LA": "LAR"}.get(player["latest_team"], player["latest_team"])
        result["teamChangedSincePreservedSnapshot"] = team != preserved["currentTeam"]
        result["positionAlias"] = "FB-to-RB existing Docked fantasy rule" if player["position"] == "FB" and preserved["position"] == "RB" else None
        assert player["position"] == preserved["position"] or result["positionAlias"], "Position mismatch requires explicit review"
        result["identityConclusion"] = "ESTABLISHED_EXACT_GSIS_AND_NAME"
    else:
        evidence = [{**witnesses[url][0], "namePresentInPage": normal(record["player"]) in witnesses[url][1]} for url in afl_sources[record["providerId"]]]
        assert any(r["namePresentInPage"] for r in evidence), "Missing AFL primary corroboration requires explicit review"
        result["officialClubEvidence"] = evidence
        result["identityConclusion"] = "ESTABLISHED_PINNED_WIKIDATA_CATALOGUE_AND_OFFICIAL_CLUB"
        result["historicalSeasons"] = {"afl:Q107491321": "Western Bulldogs 2021–2025; Gold Coast 2026", "afl:Q111831570": "Carlton 2022–2024; St Kilda 2025–2026", "afl:Q16233497": "Sydney 2013–2026", "afl:Q18580425": "St Kilda 2026 roster corroborated; historical snapshot retained", "afl:Q98690875": "St Kilda 2026 roster corroborated; historical snapshot retained"}[record["providerId"]]
        result["currentEligibilityCaution"] = {"afl:Q107491321": "2026 delist/re-draft report; no current issuance approval", "afl:Q111831570": "2026 delisting reported; no current issuance approval", "afl:Q16233497": "Official retirement announced 29 October 2026; no current issuance approval", "afl:Q18580425": "Roster presence is not commercial source approval", "afl:Q98690875": "Roster presence is not commercial source approval"}[record["providerId"]]
    result["recommendation"] = "Preserve exact existing provider identity and historical allocation; do not rewrite issued metadata or approve new issuance"
    records.append(result)

report = {"version": "v31-evidence-backed-card-identity-research-20261111", "generatedAt": datetime.now(timezone.utc).isoformat(), "productionWrites": 0, "sourceApproval": False, "currentEligibilityApproval": False, "recordsReviewed": len(records), "identitiesEstablished": len(records), "ambiguousHumanIdentities": 0, "catalogueRegistrationsToPrepare": sum(r["existingCatalogueId"] is None for r in records), "issuedCopiesCovered": sum(r["issuedCopies"] for r in records), "note": "Exact provider identity and historical custody are distinct from current team/status and permission to issue commercial stock. Official roster page presence is corroboration only; absence is not a retirement decision. Fresh names/IDs do not grant source or commercial rights.", "records": records}
(OUT / "identity-research.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({k: v for k, v in report.items() if k != "records"}))
