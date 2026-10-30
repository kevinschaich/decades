"""Genres, tags and basics for every charting artist, from the MusicBrainz JSON artist dump (CC0).

    .venv/bin/python artists.py

Streams cache/dumps/artist.tar.xz (one JSON artist per line) without unpacking it, and keeps only artists whose
name or alias matches one in songs.json. When several MusicBrainz artists share a name, the best-documented one
(most genre and tag votes) wins. Writes artists.json, keyed by the name as it appears on the chart, and genres.json: the 15 aggregate
genres of the 2015 project, kept as they were, plus a few MusicBrainz genre names that didn't exist or weren't
common then (ADDED), which build-data.ts uses to map tags to genres.
"""
import json, re, subprocess, unicodedata
from pathlib import Path

ROOT = Path(__file__).parent
DUMP = ROOT / 'cache/dumps/artist.tar.xz'

aggregate_genres = [{"rock": ["symphonic rock", "jazz-rock", "heartland rock", "rap rock", "garage rock", "folk-rock", "roots rock", "adult alternative pop rock", "rock roll", "punk rock", "arena rock", "pop-rock", "glam rock", "southern rock", "indie rock", "funk rock", "country rock", "piano rock", "art rock", "rockabilly", "acoustic rock", "progressive rock", "folk rock", "psychedelic rock", "rock & roll", "blues rock", "alternative rock", "rock and roll", "soft rock", "rock and indie", "hard rock", "pop/rock", "pop rock", "rock", "classic pop and rock", "psychedelic", "british psychedelia", "punk", "metal", "heavy metal"]},
{"alternative/indie": ["adult alternative pop rock", "alternative rock", "alternative metal", "alternative", "lo-fi indie", "indie", "indie folk", "indietronica", "indie pop", "indie rock", "rock and indie"]},
{"electronic/dance": ["dance and electronica", "electro house", "electronic", "electropop", "progressive house", "hip house", "house", "eurodance", "dancehall", "dance", "trap"]},
{"soul": ["psychedelic soul", "deep soul", "neo-soul", "neo soul", "southern soul", "smooth soul", "blue-eyed soul", "soul and reggae", "soul"]},
{"classical/soundtrack": ["classical", "orchestral", "film soundtrack", "composer"]},
{"pop": ["country-pop", "latin pop", "classical pop", "pop-metal", "orchestral pop", "instrumental pop", "indie pop", "sophisti-pop", "pop punk", "pop reggae", "britpop", "traditional pop", "power pop", "sunshine pop", "baroque pop", "synthpop", "art pop", "teen pop", "psychedelic pop", "folk pop", "country pop", "pop rap", "pop soul", "pop and chart", "dance-pop", "pop", "top 40"]},
{"hip-hop/rnb": ["conscious hip hop", "east coast hip hop", "hardcore hip hop", "west coast hip hop", "hiphop", "southern hip hop", "hip-hop", "hip hop", "hip hop rnb and dance hall", "contemporary r b", "gangsta rap", "rapper", "rap", "rhythm and blues", "contemporary rnb", "contemporary r&b", "rnb", "rhythm & blues","r&b", "blues"]},
{"disco": ["disco"]},
{"swing":  ["swing"]},
{"folk": ["contemporary folk", "folk"]},
{"country": ["country rock", "country-pop", "country pop", "contemporary country", "country"]},
{"jazz": ["vocal jazz", "jazz", "jazz-rock"]},
{"religious": ["christian", "christmas music", "gospel"]},
{"blues": ["delta blues", "rock blues", "urban blues", "electric blues", "acoustic blues", "soul blues", "country blues", "jump blues", "classic rock. blues rock", "jazz and blues", "piano blues", "british blues", "british rhythm & blues", "rhythm and blues", "blues", "blues rock", "rhythm & blues"]},
{"reggae": ["reggae fusion", "roots reggae", "reggaeton", "pop reggae", "reggae", "soul and reggae"]}]
ADDED = {
    'rock': ['rock and roll', 'doo-wop', 'new wave', 'grunge', 'pop punk', 'emo', 'post-grunge', 'nu metal'],
    'electronic/dance': ['edm', 'electro', 'big room house', 'tropical house', 'electroclash'],
    'hip-hop/rnb': ['pop rap', 'trap', 'drill', 'contemporary r&b', 'new jack swing', 'funk', 'crunk', 'southern hip hop'],
    'country': ['bro-country', 'country pop', 'outlaw country', 'country rap'],
    'pop': ['synth-pop', 'bubblegum pop', 'k-pop', 'bedroom pop', 'adult contemporary'],
    'swing': ['big band', 'swing music'],
    'jazz': ['vocal jazz', 'cool jazz', 'easy listening'],
    'religious': ['christian pop', 'contemporary christian', 'christmas'],
    'reggae': ['dancehall', 'reggaeton'],
    'folk': ['folk pop', 'singer-songwriter'],
    'classical/soundtrack': ['soundtrack', 'musical'],
}

GENRES = {}
for d in aggregate_genres:
    for k, v in d.items():
        GENRES[k] = list(dict.fromkeys(v + ADDED.get(k, [])))



def norm(s: str) -> str:
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'^the\s+', '', s.replace('&', 'and'))
    return re.sub(r'[^a-z0-9]+', '', s)


def votes(a: dict) -> int:
    return sum(g.get('count', 0) for g in a.get('genres', [])) + sum(t.get('count', 0) for t in a.get('tags', []))


def write_genres():
    json.dump({'order': list(GENRES), 'names': GENRES}, open(ROOT / 'genres.json', 'w'), indent=1, ensure_ascii=False)


def main():
    write_genres()
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
