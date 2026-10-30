"""Write the AI-pass inputs: batches/batch-NNN.jsonl, 50 songs each (git-ignored: they contain lyrics).

    .venv/bin/python batches.py
"""
import json
from pathlib import Path
from lyrics import unique_songs

ROOT = Path(__file__).parent
SIZE = 50
out = ROOT / 'batches'
out.mkdir(exist_ok=True)
songs = [s for s in unique_songs() if (ROOT / 'cache/lyrics' / f"{s['id']}.txt").exists()]
for i in range(0, len(songs), SIZE):
    with open(out / f'batch-{i // SIZE:03d}.jsonl', 'w') as f:
        for s in songs[i:i + SIZE]:
            f.write(json.dumps({'id': s['id'], 'title': s['title'], 'artist': s['artist'], 'year': s['year'],
                                'lyrics': (ROOT / 'cache/lyrics' / f"{s['id']}.txt").read_text()[:6000]}, ensure_ascii=False) + '\n')
print(len(songs), 'songs in', -(-len(songs) // SIZE), 'batches')
