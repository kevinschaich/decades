"""Merge MusicBrainz metadata into songs.json, write the AI-pass batches and print coverage.

    .venv/bin/python build.py

batches/batch-NNN.jsonl (git-ignored: they contain lyrics): about 40 songs each, one JSON object per line
with id, title, artists, year and lyrics. Songs without lyrics are left out.
"""
import json
from collections import Counter
import fc
from genres import aggregate

ROOT = fc.ROOT
SIZE = 40


def main():
    doc = json.loads((ROOT / 'songs.json').read_text())
    meta = json.loads((ROOT / 'cache' / 'metadata.json').read_text())
    artists = json.loads((ROOT / 'cache' / 'artists.json').read_text())
    for s in doc['songs']:
        r = meta.get(s['id']) or {}
        a = artists.get(r.get('artist_mbid') or '') or {}
        tags = r.get('recording_tags', []) + a.get('genres', []) + a.get('tags', [])
        s['musicbrainz'] = {k: r.get(k) for k in ('mbid', 'artist_mbid', 'duration', 'first_release_date',
                                                  'release_title', 'release_type', 'release_country', 'isrcs')} if r else None
        s['artist_info'] = {k: a.get(k) for k in ('type', 'country', 'begin')} if a else None
        s['genres'] = list(dict.fromkeys(a.get('genres', [])))[:10]
        s['tags'] = list(dict.fromkeys(tags))[:15]
        s['aggregate_genres'] = aggregate(tags)
    (ROOT / 'songs.json').write_text(json.dumps(doc, indent=1, ensure_ascii=False))

    metrics = json.loads((ROOT / 'metrics.json').read_text())['songs']
    seen, batch, n = set(), [], 0
    out = ROOT / 'batches'
    out.mkdir(exist_ok=True)
    for f in out.glob('batch-*.jsonl'): f.unlink()

    def flush():
        nonlocal batch, n
        if batch:
            n += 1
            (out / f'batch-{n:03d}.jsonl').write_text(''.join(json.dumps(x, ensure_ascii=False) + '\n' for x in batch))
            batch = []
    for s in doc['songs']:
        p = ROOT / 'cache' / 'lyrics' / f"{s['id']}.json"
        if s['id'] in seen or not p.exists(): continue
        lyr = json.loads(p.read_text())['lyrics']
        if not lyr.strip(): continue
        seen.add(s['id'])
        batch.append({'id': s['id'], 'title': s['title'], 'artists': s['primary_artists'] + s['featured_artists'],
                      'year': s['year'], 'lyrics': lyr})
        if len(batch) == SIZE: flush()
    flush()

    dec = lambda y: f'{y // 10 * 10}s'
    total, found, mb = Counter(), Counter(), Counter()
    for s in doc['songs']:
        d = dec(s['year']); total[d] += 1
        found[d] += bool((metrics.get(s['id']) or {}).get('metrics'))
        mb[d] += bool(s['musicbrainz'])
    for d in sorted(total):
        print(f'{d}: {total[d]} entries, lyrics {found[d]} ({found[d] / total[d]:.0%}), MusicBrainz {mb[d] / total[d]:.0%}')
    print('batches', n, 'songs in batches', len(seen))


if __name__ == '__main__':
    main()
