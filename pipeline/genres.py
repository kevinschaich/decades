"""The 15 aggregate genres of the 2015 project (data/aggregate_genres.py), kept as they were, plus a few
MusicBrainz genre names that didn't exist or weren't common then (marked ADDED)."""

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


def aggregate(tags):
    """Aggregate genres for ordered tags (most-voted first): all that match, the first match first."""
    out = []
    for t in tags:
        t = t.lower().strip()
        for g, names in GENRES.items():
            if t in names and g not in out:
                out.append(g)
    return out
