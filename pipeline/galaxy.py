"""Place every analyzed song on a 2D map by meaning, for the galaxy view.

    .venv/bin/python galaxy.py

Each song becomes a vector of its theme weights, mood (valence, energy), style scores, storytelling and
explicitness from analysis.json; UMAP projects those vectors to 2D so songs about similar things sit together.
Writes galaxy.json: id → [x, y] in 0..1, plus the projection settings.
"""
import json
from pathlib import Path
import numpy as np
import umap

ROOT = Path(__file__).parent
THEMES = ['love_romance', 'heartbreak', 'desire_sex', 'longing', 'partying', 'dancing', 'money_wealth', 'fame_status',
          'bragging', 'rebellion', 'freedom_escape', 'nostalgia', 'loneliness', 'empowerment', 'friendship', 'family',
          'faith_spirituality', 'social_politics', 'violence_crime', 'drugs_alcohol', 'cars_travel', 'hometown_place',
          'nature_seasons', 'youth_school', 'technology_media', 'self_reflection', 'mental_health', 'celebration_joy',
          'war_conflict', 'work_struggle']
STYLE = ['hookCentric', 'conversational', 'imagery', 'slang', 'complexity', 'humor', 'aggression', 'vulnerability']
SETTINGS = {'n_neighbors': 30, 'min_dist': 0.08, 'metric': 'cosine', 'random_state': 42}


def vector(r):
    mood, style, narrative = r.get('mood') or {}, r.get('style') or {}, r.get('narrative') or {}
    return ([(r.get('themes') or {}).get(t, 0.0) for t in THEMES]
            + [((mood.get('valence') or 0) + 1) / 2, mood.get('energy') or 0]
            + [style.get(s) or 0 for s in STYLE]
            + [narrative.get('storytelling') or 0, (r.get('explicitness') or 0) / 3])


def main():
    recs = [r for r in json.load(open(ROOT / 'analysis.json')) if r.get('lyricsUsable')]
    X = np.array([vector(r) for r in recs], dtype=float) + 1e-6
    xy = umap.UMAP(**SETTINGS).fit_transform(X)
    xy = (xy - xy.min(0)) / (xy.max(0) - xy.min(0))
    out = {'settings': {**SETTINGS, 'features': THEMES + ['valence', 'energy'] + STYLE + ['storytelling', 'explicitness']},
           'points': {r['id']: [round(float(x), 4), round(float(y), 4)] for r, (x, y) in zip(recs, xy)}}
    json.dump(out, open(ROOT / 'galaxy.json', 'w'))
    print(len(out['points']), 'songs placed')


if __name__ == '__main__':
    main()
