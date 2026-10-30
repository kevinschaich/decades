"""Match every chart song to its lyrics in the LRCLIB database dump, entirely offline.

    gunzip -k cache/dumps/lrclib.sqlite3.gz   # once, about 245 GB unpacked
    .venv/bin/python lyrics_dump.py

For each song in songs.json, looks up LRCLIB tracks whose normalized title matches and whose artist matches one
of the song's artists, and prefers non-instrumental tracks with plain lyrics. Lyrics go to cache/lyrics/<id>.txt
(git-ignored: lyrics are copyrighted). Writes lyrics-coverage.json (committed): per song, whether lyrics were
found and how well they matched, with no lyric text.
"""
import json, re, sqlite3, unicodedata
from pathlib import Path

ROOT = Path(__file__).parent
DB = ROOT / 'cache/dumps/lrclib.sqlite3'
OUT = ROOT / 'cache/lyrics'


def norm(s: str) -> str:
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'\(.*?\)|\[.*?\]', '', s)  # (feat. x), (remix), [live]
    s = re.sub(r'^the\s+', '', s.replace('&', 'and'))
    return re.sub(r'[^a-z0-9]+', '', s)


def artist_key(s: str) -> str:
    """Artist names keep every script (so '스테이씨 (STAYC)' doesn't collapse to an empty string)."""
    s = unicodedata.normalize('NFKC', s or '').lower().replace('&', 'and')
    s = re.sub(r'^the\s+', '', s)
    return re.sub(r'[\W_]+', '', s)


def same_artist(a: str, artists: set) -> bool:
    if not a:
        return False
    return a in artists or any(x and min(len(x), len(a)) >= 4 and (x in a or a in x) for x in artists)


def main():
    db = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
    cols = {t: [r[1] for r in db.execute(f'pragma table_info({t})')] for (t,) in db.execute("select name from sqlite_master where type='table'")}
    print({t: c for t, c in cols.items() if t in ('tracks', 'lyrics')})
    # Index on the lowercase title once; the dump is read-only, so build it in a small side database
    side = sqlite3.connect(ROOT / 'cache/dumps/title-index.sqlite3')
    side.execute('create table if not exists t (key text, track_id integer)')
    if not side.execute('select 1 from t limit 1').fetchone():
        print('indexing titles…', flush=True)
        batch = []
        for tid, name in db.execute('select id, name from tracks'):
            batch.append((norm(name), tid))
            if len(batch) == 200_000:
                side.executemany('insert into t values (?, ?)', batch); batch = []
        side.executemany('insert into t values (?, ?)', batch)
        side.execute('create index if not exists k on t(key)')
        side.commit()
    songs = json.load(open(ROOT / 'songs.json'))['songs']
    OUT.mkdir(parents=True, exist_ok=True)
    coverage = {}
    for i, s in enumerate(songs):
        if i % 500 == 0:
            print(i, 'songs,', sum(c['found'] for c in coverage.values()), 'found', flush=True)
        # Double A-sides ("Bird Dog / Devoted to You") match on the first side
        title = s['title'].split(' / ')[0]
        ids = [r[0] for r in side.execute('select track_id from t where key = ?', (norm(title),))]
        names = s['primary_artists'] + s['featured_artists'] + [s['artist']]
        names += [p for n in names for p in re.split(r'\s+(?:with|and|featuring|feat\.?|ft\.?|&|x)\s+|,\s*', n, flags=re.I)]
        artists = {artist_key(a) for a in names if artist_key(a)}
        best, instrumental = None, False
        for tid in ids:
            row = db.execute(
                'select t.artist_name, t.duration, l.plain_lyrics, l.instrumental from tracks t '
                'join lyrics l on l.id = t.last_lyrics_id where t.id = ?', (tid,)).fetchone()
            if not row:
                continue
            a = artist_key(row[0])
            exact = same_artist(a, artists)
            if row[3] and exact:
                instrumental = True  # the charting artist's own recording is flagged instrumental
            if not row[2] or row[3]:
                continue
            score = (2 if exact else 0) + min(len(row[2]), 4000) / 4000
            if best is None or score > best[0]:
                best = (score, exact, row)
        if best and best[1]:
            (OUT / f"{s['id']}.txt").write_text(best[2][2])
            coverage[s['id']] = {'found': True, 'match': 'artist+title', 'lrclibArtist': best[2][0]}
        elif instrumental:
            coverage[s['id']] = {'found': False, 'match': 'instrumental'}
        else:
            coverage[s['id']] = {'found': False, 'match': 'title-only' if best else 'none'}
    json.dump(coverage, open(ROOT / 'lyrics-coverage.json', 'w'), indent=1, ensure_ascii=False)
    found = sum(c['found'] for c in coverage.values())
    print(f'{found} of {len(songs)} songs have lyrics')


if __name__ == '__main__':
    main()
