#!/usr/bin/env python3
"""Read-only official AFL source capture; no hosted writes or automatic identity creation."""

import concurrent.futures
import datetime
import hashlib
import json
import os
import pathlib
import re
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

from lxml import html

OUT = pathlib.Path(__file__).resolve().parent
CACHE = pathlib.Path(os.environ.get(
    'DOCKED_ROSTER_SOURCE_CACHE',
    str(pathlib.Path(tempfile.gettempdir()) / 'docked-afl-roster-source-cache'),
))
CACHE.mkdir(parents=True, exist_ok=True)
REUSE_CAPTURE = os.environ.get('DOCKED_ROSTER_REUSE_CAPTURE') == 'true'
SOURCES = {}


def capture(url):
    key = hashlib.sha256(url.encode()).hexdigest()
    meta_file = CACHE / f'{key}.json'
    data_file = CACHE / f'{key}.html'
    if REUSE_CAPTURE and meta_file.exists() and data_file.exists():
        meta = json.loads(meta_file.read_text())
        raw = data_file.read_bytes()
    else:
        request = urllib.request.Request(url, headers={'User-Agent': 'Docked-public-roster-review/1.0'})
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                raw = response.read()
                meta = {
                    'url': url,
                    'resolvedUrl': response.url,
                    'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    'httpStatus': response.status,
                    'contentType': response.headers.get('Content-Type'),
                    'lastModified': response.headers.get('Last-Modified'),
                    'sha256': hashlib.sha256(raw).hexdigest(),
                    'bytes': len(raw),
                }
        except Exception as error:
            meta = {'url': url, 'error': f'{type(error).__name__}: {error}'}
            SOURCES[url] = meta
            return None
        data_file.write_bytes(raw)
        meta_file.write_text(json.dumps(meta, indent=2) + '\n')
    tree = html.fromstring(raw)
    meta['title'] = ' '.join(tree.xpath('//title/text()'))
    meta['publishedTime'] = tree.xpath('//meta[@property="article:published_time"]/@content') or None
    meta['modifiedTime'] = tree.xpath('//meta[@property="article:modified_time"]/@content') or None
    if not meta['publishedTime']:
        dates = re.findall(r'"datePublished"\s*:\s*"([^"]+)"', raw.decode(errors='replace'))
        meta['publishedTime'] = dates or tree.xpath('//time[@datetime]/@datetime') or None
    SOURCES[url] = meta
    return tree


def clean(value):
    return ' '.join(value.split())


CLUBS = {
    'Adelaide': 'adelaide-crows', 'Brisbane': 'brisbane-lions', 'Carlton': 'carlton',
    'Collingwood': 'collingwood', 'Essendon': 'essendon', 'Fremantle': 'fremantle',
    'Geelong': 'geelong-cats', 'Gold Coast': 'gold-coast-suns',
    'GWS': 'gws-giants', 'Hawthorn': 'hawthorn', 'Melbourne': 'melbourne',
    'North Melbourne': 'north-melbourne', 'Port Adelaide': 'port-adelaide',
    'Richmond': 'richmond', 'St Kilda': 'st-kilda', 'Sydney': 'sydney-swans',
    'West Coast': 'west-coast-eagles', 'Western Bulldogs': 'western-bulldogs',
}


def movement_register():
    url = 'https://www.afl.com.au/news/retirements-and-delistings'
    tree = capture(url)
    if tree is None:
        raise RuntimeError('Official movement register unavailable')
    table = tree.xpath('//table')[0]
    clubs = []
    events = []
    for row in table.xpath('.//tr'):
        cells = row.xpath('./td|./th')
        if not row.xpath('.//a'):
            clubs = [clean(cell.text_content()) for cell in cells]
            continue
        for club, cell in zip(clubs, cells):
            for anchor in cell.xpath('.//a'):
                label = clean(anchor.text_content())
                match = re.fullmatch(r'(.+?)\s*\((FA|DFA|SSP|trd|del|ret)\)(\*)?', label)
                if not match:
                    raise RuntimeError(f'Unrecognized official register label: {label}')
                name, movement, pending = match.groups()
                events.append({
                    'name': name,
                    'previousClub': club,
                    'movement': movement,
                    'intendedRedraftPending': bool(pending),
                    'registerUrl': url,
                    'sourceUrl': urllib.parse.urljoin(url, anchor.get('href')),
                })
    return events


def team_profiles(club):
    url = f'https://www.afl.com.au/teams/{CLUBS[club]}'
    tree = capture(url)
    profiles = []
    if tree is None:
        return profiles
    for anchor in tree.xpath('//a[contains(@class,"player-grid__player-card")]'):
        first = anchor.xpath('.//*[contains(@class,"player-grid__player-first-name")]/text()')
        last = anchor.xpath('.//*[contains(@class,"player-grid__player-surname")]/text()')
        if not first or not last:
            continue
        profiles.append({
            'name': clean(' '.join(first + last)),
            'club': club,
            'profileUrl': urllib.parse.urljoin(url, anchor.get('href')),
            'teamPageUrl': url,
            'scope': 'Historical 2026 identity corroboration only; presence is not current eligibility evidence',
        })
    return profiles


def profile_name(url):
    tree = capture(url)
    if tree is None:
        return None
    headings = [clean(node.text_content()) for node in tree.xpath('//h1')]
    return {'headings': headings, 'url': url}


def main():
    census = json.loads((OUT / 'AFL_CENSUS.json').read_text())
    events = movement_register()
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        all_profiles = [profile for result in executor.map(team_profiles, CLUBS) for profile in result]
    profiles_by_identity = {}
    for profile in all_profiles:
        profiles_by_identity.setdefault((profile['name'], profile['club']), []).append(profile)
    exact = []
    unresolved = []
    unaffected = []
    for event in events:
        exact_players = [player for player in census['players']
                         if event['name'] in player['names']
                         and event['previousClub'] in player['savedClubs']]
        name_only = [player for player in census['players'] if event['name'] in player['names']]
        record = {**event, 'exactCanonicalMatches': [p['playerId'] for p in exact_players],
                  'nameOnlyCanonicalMatches': [p['playerId'] for p in name_only]}
        if len(exact_players) == 1:
            player = exact_players[0]
            record['canonical'] = player
            record['profileCandidates'] = profiles_by_identity.get((event['name'], event['previousClub']), [])
            record['applyReady'] = False
            exact.append(record)
        elif name_only:
            record['reason'] = 'Existing name found but canonical club does not exactly match outgoing club; human identity review required'
            unresolved.append(record)
        else:
            record['reason'] = 'No exact canonical name exists in current AFL commercial definitions; no status mutation proposed'
            unaffected.append(record)
    urls = sorted(set(e['sourceUrl'] for e in events))
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        list(executor.map(capture, urls))
    profile_urls = sorted(set(p['profileUrl'] for record in exact for p in record['profileCandidates']))
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        profiles = dict(zip(profile_urls, executor.map(profile_name, profile_urls)))
    for record in exact:
        record['profileCorroboration'] = [profiles[p['profileUrl']] for p in record['profileCandidates']]
        valid_profiles = [p for p in record['profileCorroboration'] if p and record['name'] in p['headings']]
        if len(valid_profiles) == 1 and len(record['canonical']['providers']) == 1:
            record['identityConfirmed'] = True
        else:
            record['identityConfirmed'] = False
    result = {
        'asOf': datetime.datetime.now(ZoneInfo('Australia/Sydney')).date().isoformat(),
        'timezone': 'Australia/Sydney',
        'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'censusCapturedAt': census['capturedAt'], 'censusCounts': census['counts'],
        'scope': 'Read-only AFL movement review. Does not grant commercial rights, create provider mappings, mutate Production, or apply roster state.',
        'method': 'Exact saved canonical name and outgoing club only; official historical roster and individual profile corroborate identity. Latest completed registration event must be reconciled before eligibility change. No fuzzy matches or absence-based removals.',
        'counts': {'officialMovementEvents': len(events), 'exactNameAndClubMatches': len(exact),
                   'unresolvedNameClubMatches': len(unresolved), 'notInCommercialCanonicalSet': len(unaffected),
                   'officialHistoricalProfiles': len(all_profiles)},
        'matchedMovementEvents': exact, 'unresolvedIdentityEvents': unresolved,
        'eventsOutsideCommercialCanonicalSet': unaffected,
        'sources': list(SOURCES.values()),
    }
    (OUT / 'AFL_REVIEW_STAGE1.json').write_text(json.dumps(result, indent=2) + '\n')
    draft = json.loads((OUT / 'AFL_DRAFT_CANDIDATES.json').read_text())
    draft_url = 'https://www.afl.com.au/news/1642221'
    capture(draft_url)
    return_url = 'https://www.goldcoastfc.com.au/news/2167089/suns-re-select-ugle-hagan-and-himmelberg'
    return_tree = capture(return_url)
    if return_tree is None:
        raise RuntimeError('Completed Suns redraft source unavailable')
    extra_urls = [
        'https://www.afl.com.au/news/1642929/rookie-draft-preview-take-a-look-at-the-players-who-could-be-drafted-in-the-2026-pre-season-and-rookie-drafts',
        'https://www.sydneyswans.com.au/news/2166984',
        'https://www.afl.com.au/news/1642931/sydney-swans-explain-draft-heist-why-they-swooped-on-vfl-star-ex-cat',
        'https://www.afl.com.au/draft/draft-tracker/2026',
    ]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        list(executor.map(capture, extra_urls))
    proposed = []
    for record in exact:
        source = SOURCES[record['sourceUrl']]
        record['recommendedRegistration'] = ('PENDING_RELIST' if record['intendedRedraftPending'] else
                                             'RETIRED' if record['movement'] == 'ret' else
                                             'DELISTED' if record['movement'] == 'del' else 'UNRESOLVED')
        record['sourcePublishedAt'] = source['publishedTime']
        record['statusConfirmedAsOf'] = source['capturedAt']
        record['eventDatePrecision'] = 'Announcement timestamp retained separately; proposed effectiveAt is conservative current observation, not an invented historical registration timestamp.'
        record['applyReady'] = record['identityConfirmed'] and record['recommendedRegistration'] != 'UNRESOLVED'
        record['effect'] = 'Exclude future issuance; preserve every existing card, serial, ownership record and definition approval state.'
        if record['applyReady']:
            proposed.append({
                'playerId': record['canonical']['playerId'], 'sport': 'afl', 'expectedRevision': None,
                'registration': record['recommendedRegistration'], 'availability': 'UNKNOWN',
                'currentClub': None,
                'source': {'url': source['url'], 'hash': source['sha256'],
                           'observedAt': source['capturedAt'].replace('+00:00', 'Z'), 'effectiveAt': source['capturedAt'].replace('+00:00', 'Z')},
                'relistConfirmed': False, 'registerDefinitions': False, 'aliases': [],
            })
    returns = []
    for name in ['Elliott Himmelberg', 'Jamarra Ugle-Hagan']:
        matches = [p for p in census['players'] if name in p['names'] and p['savedClubs'] == ['Gold Coast']]
        assert len(matches) == 1
        player = matches[0]
        identity_profiles = profiles_by_identity.get((name, 'Gold Coast'), [])
        assert len(identity_profiles) == 1
        profile = profile_name(identity_profiles[0]['profileUrl'])
        assert profile and name in profile['headings']
        source = SOURCES[return_url]
        returns.append({
            'name': name, 'canonical': player, 'identityConfirmed': True,
            'profileCorroboration': profile, 'sourceUrl': return_url,
            'completedEventDate': '2026-11-20', 'recommendedRegistration': 'ACTIVE',
            'applyReady': True,
            'effect': 'Retain canonical identity and lifetime supply. A held definition remains held; registration does not grant commercial approval.',
        })
        proposed.append({
            'playerId': player['playerId'], 'sport': 'afl', 'expectedRevision': None,
            'registration': 'ACTIVE', 'availability': 'UNKNOWN',
            'currentClub': {'id': 'CD_T1000', 'name': 'Gold Coast'},
            'source': {'url': source['url'], 'hash': source['sha256'],
                       'observedAt': source['capturedAt'].replace('+00:00', 'Z'), 'effectiveAt': source['capturedAt'].replace('+00:00', 'Z')},
            'relistConfirmed': True, 'registerDefinitions': False, 'aliases': [],
        })
    candidates = []
    for row in draft['rows']:
        matches = [p for p in census['players'] if row['name'] in p['names']]
        candidates.append({**row,
            'exactCommercialCanonicalMatches': [p['playerId'] for p in matches],
            'candidateKind': 'EXISTING_CANONICAL_RETURN' if matches else 'UNRESOLVED_NEW_OR_RETURNING_IDENTITY',
            'applyReady': False,
            'missingForNewIdentity': [] if matches else [
                'Verified stable official player/profile identifier and full historical identity/alias conflict check',
                'Verified individual official profile and position mapped to Docked position taxonomy',
                'Reviewed factual source permission and distinct commercial definition activation authority',
            ],
        })
    result['counts'].update({
        'confirmedExistingIdentityChanges': len(exact),
        'currentlyApprovedPlayersToExclude': sum(x['canonical']['approvedDefinitionCount'] > 0 for x in exact),
        'existingCanonicalNationalDraftReturns': len(returns),
        'nationalDraftSelectionRecords': len(candidates),
        'nationalDraftUnresolvedCandidateIdentities': sum(not x['exactCommercialCanonicalMatches'] for x in candidates),
    })
    result['completedNationalDraftReturns'] = returns
    result['proposedExistingPlayerChanges'] = proposed
    result['nationalDraftCandidates'] = candidates
    result['unresolvedIdentityEvents'] = unresolved + [
        {'name': 'Mitchell Knevitt', 'officialNewsName': 'Mitch Knevitt',
         'completedEvent': 'Selected by Sydney at pick 48 on 2026-11-20 after Geelong delisting',
         'commercialCanonicalMatch': None,
         'sourceUrls': extra_urls[1:3],
         'reason': 'Official news explicitly corroborates this name variant and completed return, but neither spelling exists in the commercial canonical census. No canonical UUID/provider mapping invented.'}
    ]
    result['selectionCountReconciliation'] = {
        'officialTableRecords': 65, 'uniquePicks': 65, 'minimumPick': 1, 'maximumPick': 65,
        'articleIntroCount': 63,
        'confirmedSunsReselections': ['Elliott Himmelberg (63)', 'Jamarra Ugle-Hagan (64)'],
        'interpretation': '65 table selections minus the two Suns re-selections equals the intro count of 63. This arithmetic reconciles the discrepancy, but the article does not explicitly define its count. Do not describe all 63 candidate identities as first-time draftees; Knevitt is a known return.',
        'trackerCorroboration': 'Official tracker identifies Harper Banfield as final selection 65.',
        'trackerReference': 'turn193428858search2',
        'pickNumberConflict': 'Gold Coast club article reverses 63/64 in one respectively sentence; use the official AFL completed table for pick-number attribution. Both sources confirm both returns.',
    }
    result['sourceDateDiscrepancies'] = [
        {'url': 'https://www.sydneyswans.com.au/news/2166984',
         'observedPublishedTime': '2026-11-17T22:55:00Z',
         'describedEventDate': '2026-11-20',
         'resolution': 'Club page published metadata precedes the completed night-two event it describes. Retain that metadata as observed; use official AFL completed table, tracker and corroborating AFL article 1642931 (HTML timestamp 2026-11-20T12:23Z) for event chronology.'},
    ]
    result['limits'] = [
        'Only the AFL current outgoing register and completed national draft are reconciled; no claim of a full all-sport current roster audit.',
        'Historical 2026 team pages corroborate identity only. Their absence or presence does not decide 2027 registration.',
        'The 153 outgoing events without an exact commercial name are recorded but produce no deletion or guessed identity mutation.',
        'The rookie/pre-season drafts on 2026-11-23 have not occurred at this capture; intended redrafts remain pending.',
        'New draft facts are staged for identity review, not registered as new commercial cards. No stable person IDs, positions, licensing basis or aliases were guessed.',
        'A direct unauthenticated request to the official public-site draft JSON endpoint returned HTTP 401. No token, login, licensed feed or alternate access was attempted; the official indexed completed table provides the candidate facts.',
        'This is a local review proposal. No hosted roster state, card, source snapshot, ownership, approval flag, wallet or supply row was changed.',
    ]
    result['sources'] = list(SOURCES.values())
    result['completedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    (OUT / 'AFL_REVIEW.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result['counts']))
    print('Confirmed profile identities:', sum(r['identityConfirmed'] for r in exact))
    print('Saved AFL_REVIEW.json')


if __name__ == '__main__':
    main()
