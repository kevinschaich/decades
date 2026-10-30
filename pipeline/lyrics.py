"""Fetch lyrics from LRCLIB (through Firecrawl) into cache/lyrics/<id>.json (git-ignored: lyrics are copyrighted).

    .venv/bin/python lyrics.py

For each unique song: LRCLIB /api/search by track and artist (then a free-text search as fallback), and the
best candidate by title, artist and, when metadata.json has a MusicBrainz duration, the closest duration.
Writes cache/lyrics/<id>.json with the lyrics and cache/lyrics_matches.json with the match.
"""
import json, re, sys, urllib.parse
from difflib import SequenceMatcher
import fc
from songs import norm

ROOT = fc.ROOT
OUT = ROOT / 'cache' / 'lyrics'
OUT.mkdir(parents=True, exist_ok=True)
API = 'https://lrclib.net/api/search?'


def sim(a, b):
    a, b = norm(a), norm(b)
    if not a or not b: return 0.0
    if a == b: return 1.0
    if a in b or b in a: return 0.9
    return SequenceMatcher(None, a, b).ratio()


def unique_songs():
    songs = json.loads((ROOT / 'songs.json').read_text())['songs']
    seen = {}
    for s in songs:
        seen.setdefault(s['id'], s)
    return list(seen.values())


def queries(s):
    title = re.sub(r'\s*/\s*.*$', '', s['title'])  # first side of a double A-side
    artist = s['primary_artists'][0]
    return [API + urllib.parse.urlencode({'track_name': title, 'artist_name': artist}),
            API + urllib.parse.urlencode({'q': f'{title} {artist}'})]


def pick(s, cands, duration):
    title = re.sub(r'\s*/\s*.*$', '', s['title'])
    best, best_score = None, 0
    for c in cands:
        if not (c.get('plainLyrics') or c.get('instrumental')): continue
        ts = sim(title, c.get('trackName') or '')
        as_ = max(sim(a, c.get('artistName') or '') for a in s['primary_artists'] + s['featured_artists'])
        if ts < 0.8 or as_ < 0.6: continue
        score = ts + as_
        if duration and c.get('duration'):
            score -= min(abs(c['duration'] - duration), 60) / 60  # up to one point off for a minute's gap
        if score > best_score: best, best_score = c, score
    return best


def quality(s, c, duration):
    title = re.sub(r'\s*/\s*.*$', '', s['title'])
    exact = norm(title) == norm(c['trackName']) and any(norm(a) == norm(c['artistName']) for a in s['primary_artists'])
    q = 'exact' if exact else 'fuzzy'
    gap = round(abs(c['duration'] - duration), 1) if duration and c.get('duration') else None
    if gap is not None and gap <= 5: q += '+duration'
    return q, gap


def main():
    meta = json.loads((ROOT / 'cache' / 'metadata.json').read_text()) if (ROOT / 'cache' / 'metadata.json').exists() else {}
    songs = unique_songs()
    matches, first = {}, {}
    for i, s in enumerate(songs):
        if i % 250 == 0:  # batch-scrape the next 250 first queries, so files appear as each chunk lands
            first.update(fc.scrape_many([queries(x)[0] for x in songs[i:i + 250]]))
        duration = (meta.get(s['id']) or {}).get('duration')
        c = pick(s, fc.json_body(first[queries(s)[0]]) or [], duration)
        if not c:
            c = pick(s, fc.json_body(fc.scrape(queries(s)[1])) or [], duration)
        if not c:
            matches[s['id']] = {'found': False}
            continue
        q, gap = quality(s, c, duration)
        matches[s['id']] = {'found': True, 'lrclib_id': c['id'], 'instrumental': c.get('instrumental', False),
                            'track': c['trackName'], 'artist': c['artistName'], 'album': c.get('albumName'),
                            'duration': c.get('duration'), 'quality': q, 'duration_gap': gap}
        (OUT / f"{s['id']}.json").write_text(json.dumps({'id': s['id'], 'lrclib_id': c['id'],
                                                           'lyrics': c.get('plainLyrics') or ''}, ensure_ascii=False))
        if i % 500 == 0: print(i, flush=True)
    (ROOT / 'cache' / 'lyrics_matches.json').write_text(json.dumps(matches, indent=1, ensure_ascii=False))
    print('found', sum(m['found'] for m in matches.values()), 'of', len(matches))


if __name__ == '__main__':
    main()
