"""Genres, tags and basics for every charting artist, from the MusicBrainz JSON artist dump (CC0).

    .venv/bin/python artists.py

Streams cache/dumps/artist.tar.xz (one JSON artist per line) without unpacking it, and keeps only artists whose
name or alias matches one in songs.json. When several MusicBrainz artists share a name, the best-documented one
(most genre and tag votes) wins. Writes artists.json, keyed by the name as it appears on the chart.
"""
import json, re, subprocess, unicodedata
from pathlib import Path

ROOT = Path(__file__).parent
DUMP = ROOT / 'cache/dumps/artist.tar.xz'


def norm(s: str) -> str:
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'^the\s+', '', s.replace('&', 'and'))
    return re.sub(r'[^a-z0-9]+', '', s)


def votes(a: dict) -> int:
    return sum(g.get('count', 0) for g in a.get('genres', [])) + sum(t.get('count', 0) for t in a.get('tags', []))


def main():
    songs = json.load(open(ROOT / 'songs.json'))['songs']
    wanted = {}
    for s in songs:
        for name in s['primary_artists'] + s['featured_artists']:
            wanted.setdefault(norm(name), name)
    best = {}
    tar = subprocess.Popen(['tar', '-xJOf', str(DUMP), 'mbdump/artist'], stdout=subprocess.PIPE)
    for n, line in enumerate(tar.stdout):
        if n % 500_000 == 0:
            print(n, 'artists read,', len(best), 'matched', flush=True)
        a = json.loads(line)
        keys = {norm(a['name'])} | {norm(x['name']) for x in a.get('aliases', [])}
        for k in keys & wanted.keys():
            if k not in best or votes(a) > votes(best[k]):
                best[k] = a
    out = {}
    for k, name in wanted.items():
        a = best.get(k)
        if not a:
            continue
        life = a.get('life-span') or {}
        out[name] = {
            'mbid': a['id'],
            'mbName': a['name'],
            'type': a.get('type'),
            'gender': a.get('gender'),
            'country': a.get('country'),
            'area': (a.get('area') or {}).get('name'),
            'begin': (life.get('begin') or '')[:4] or None,
            'end': (life.get('end') or '')[:4] or None,
            'genres': sorted(({'name': g['name'], 'count': g.get('count', 0)} for g in a.get('genres', [])), key=lambda g: -g['count']),
            'tags': sorted(({'name': t['name'], 'count': t.get('count', 0)} for t in a.get('tags', [])), key=lambda t: -t['count'])[:20],
        }
    json.dump(out, open(ROOT / 'artists.json', 'w'), indent=1, ensure_ascii=False)
    print(f'{len(out)} of {len(wanted)} artists matched')


if __name__ == '__main__':
    main()
