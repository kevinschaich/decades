"""MusicBrainz metadata for every song, through Firecrawl, at most one request started per second.

    .venv/bin/python metadata.py

Per song: a recording search (title + primary artist) → the matching recording with the earliest release:
duration, first release date and title, release type, ISRCs, recording tags. Per primary artist: genres and tags,
type, country, begin year. Tags/genres map to the 15 aggregate genres of the 2015 project (genres.py).
Writes cache/metadata.json; build.py merges it into songs.json.
"""
import json, re, threading, time, urllib.parse
from concurrent.futures import ThreadPoolExecutor
import fc
from lyrics import sim, unique_songs

ROOT = fc.ROOT
MB = 'https://musicbrainz.org/ws/2/'
_lock, _last = threading.Lock(), [0.0]


def mb(path):
    """MusicBrainz asks for at most 1 request per second; cached responses don't count."""
    url = MB + path
    if fc.cached(url) is None:
        with _lock:
            wait = _last[0] + 1.05 - time.time()
            if wait > 0: time.sleep(wait)
            _last[0] = time.time()
    res = fc.scrape(url)
    for _ in range(4):  # throttled or the fetch failed: back off and retry
        if res.get('status') in (200, 404): break
        time.sleep(5); res = fc.scrape(url, refresh=True)
    if res.get('status') not in (200, 404):
        raise RuntimeError(f'MusicBrainz fetch failed: {url}')
    return fc.json_body(res) or {}


def lucene(s):
    return re.sub(r'([+\-&|!(){}\[\]^"~*?:\\/])', r'\\\1', s)


def recording(s):
    title = re.sub(r'\s*/\s*.*$', '', s['title'])
    artist = s['primary_artists'][0]
    q = f'recording:"{lucene(title)}" AND artist:"{lucene(artist)}"'
    j = mb('recording/?' + urllib.parse.urlencode({'query': q, 'fmt': 'json', 'limit': 25}))
    best = []
    for r in j.get('recordings') or []:
        credit = ' '.join(a.get('name', '') + a.get('joinphrase', '') for a in r.get('artist-credit') or [])
        if sim(title, r.get('title', '')) < 0.9 or sim(artist, credit) < 0.6: continue
        if re.search(r'\b(live|remix|demo|instrumental|karaoke)\b', (r.get('disambiguation') or '').lower()): continue
        best.append(r)
    if not best: return None
    best.sort(key=lambda r: (r.get('first-release-date') or '9999', -int(r.get('score') or 0)))
    r = best[0]
    lengths = sorted(x['length'] for x in best[:8] if x.get('length'))
    rel = sorted(r.get('releases') or [], key=lambda x: x.get('date') or '9999')
    rel = rel[0] if rel else {}
    return {
        'mbid': r['id'],
        'artist_mbid': ((r.get('artist-credit') or [{}])[0].get('artist') or {}).get('id'),
        # the median of the earliest matching recordings' lengths, so one odd edit doesn't skew it
        'duration': round(lengths[len(lengths) // 2] / 1000, 1) if lengths else None,
        'first_release_date': r.get('first-release-date'),
        'release_title': rel.get('title'),
        'release_type': (rel.get('release-group') or {}).get('primary-type'),
        'release_country': rel.get('country'),
        'isrcs': r.get('isrcs') or [],
        'recording_tags': [t['name'] for t in sorted(r.get('tags') or [], key=lambda t: -t.get('count', 0))],
    }


def artist(mbid):
    j = mb(f'artist/{mbid}?' + urllib.parse.urlencode({'inc': 'genres+tags', 'fmt': 'json'}))
    if not j.get('id'): return None
    by = lambda xs: [x['name'] for x in sorted(xs or [], key=lambda x: -x.get('count', 0))]
    return {'name': j.get('name'), 'type': j.get('type'), 'country': j.get('country'),
            'begin': (j.get('life-span') or {}).get('begin'), 'genres': by(j.get('genres')), 'tags': by(j.get('tags'))}


def safe(fn):
    def run(x):
        try: return fn(x)
        except RuntimeError as e: print(e, flush=True); return 'retry'
    return run


def main():
    path = ROOT / 'cache' / 'metadata.json'
    out = json.loads(path.read_text()) if path.exists() else {}
    songs = [s for s in unique_songs() if s['id'] not in out]
    with ThreadPoolExecutor(6) as ex:  # parallel waits on Firecrawl; the lock keeps starts ≥1 s apart
        for i, (s, rec) in enumerate(zip(songs, ex.map(safe(recording), songs))):
            if rec != 'retry': out[s['id']] = rec or {}
            if i % 10 == 0:
                print('recordings', i, len(songs), flush=True); path.write_text(json.dumps(out))
    path.write_text(json.dumps(out))
    artists = sorted({r['artist_mbid'] for r in out.values() if r.get('artist_mbid')})
    amap_path = ROOT / 'cache' / 'artists.json'
    amap = json.loads(amap_path.read_text()) if amap_path.exists() else {}
    todo = [a for a in artists if a not in amap]
    with ThreadPoolExecutor(6) as ex:
        for i, (a, info) in enumerate(zip(todo, ex.map(safe(artist), todo))):
            if info != 'retry': amap[a] = info or {}
            if i % 200 == 0:
                print('artists', i, len(todo), flush=True); amap_path.write_text(json.dumps(amap))
    amap_path.write_text(json.dumps(amap))
    print('recordings matched', sum(bool(r) for r in out.values()), 'of', len(out), '; artists', len(amap))


if __name__ == '__main__':
    main()
