"""Deterministic text metrics per song from the cached lyrics. Writes metrics.json (numbers only, no lyric text).

    .venv/bin/python metrics.py
"""
import json, re, zlib
import pronouncing
import fc
from songs import norm, unique_songs

ROOT = fc.ROOT
PROFANITY_URL = 'https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/master/en'
PRONOUNS = {
    'i': {'i', "i'm", "i've", "i'll", "i'd", 'me', 'my', 'mine', 'myself'},
    'you': {'you', "you're", "you've", "you'll", "you'd", 'your', 'yours', 'yourself', 'ya', 'yourselves'},
    'we': {'we', "we're", "we've", "we'll", "we'd", 'us', 'our', 'ours', 'ourselves'},
    'they': {'they', "they're", "they've", "they'll", "they'd", 'them', 'their', 'theirs', 'themselves'},
}


def clean_lines(text):
    """Lyric lines without section labels like [Chorus] or blank lines."""
    out = []
    for line in text.splitlines():
        line = re.sub(r'\[[^\]]*\]', '', line).strip()
        if line: out.append(line)
    return out


def words_of(text):
    return re.findall(r"[a-z0-9]+(?:'[a-z]+)?", text.lower().replace('’', "'"))


def rhyme_key(word):
    phones = pronouncing.phones_for_word(word)
    return pronouncing.rhyming_part(phones[0]) if phones else word[-3:]


def rhyme_density(lines):
    """Share of lines whose last word rhymes with the last word of one of the next three lines (or is
    rhymed by one of the previous three). Same-word repeats don't count as rhymes. CMU dict, else last 3 letters."""
    ends = [w[-1] for w in (words_of(l) for l in lines) if w]
    if len(ends) < 2: return 0.0
    keys = [rhyme_key(w) for w in ends]
    hit = [False] * len(ends)
    for i in range(len(ends)):
        for j in range(i + 1, min(i + 4, len(ends))):
            if keys[i] == keys[j] and ends[i] != ends[j]:
                hit[i] = hit[j] = True
    return round(sum(hit) / len(ends), 4)


def profanity_list():
    body = fc.scrape(PROFANITY_URL)['body']
    return {w.strip().lower() for w in body.splitlines() if w.strip()}


def measure(title, text, profane):
    lines = clean_lines(text)
    body = '\n'.join(lines)
    words = words_of(body)
    if not words: return None
    raw = body.lower().encode()
    joined = ' ' + ' '.join(words) + ' '
    multi = [p for p in profane if ' ' in p]
    title_core = norm(re.sub(r'\s*/\s*.*$', '', title))
    return {
        'word_count': len(words),
        'unique_words': len(set(words)),
        'lexical_diversity': round(len(set(words)) / len(words), 4),
        # compressed / raw size (zlib level 9): lower means more repetitive
        'compression_ratio': round(len(zlib.compress(raw, 9)) / len(raw), 4),
        'repetition': round(1 - len(zlib.compress(raw, 9)) / len(raw), 4),
        'rhyme_density': rhyme_density(lines),
        'avg_word_length': round(sum(len(w.replace("'", '')) for w in words) / len(words), 3),
        'profanity_count': sum(w in profane for w in words) + sum(joined.count(f' {p} ') for p in multi),
        'pronouns': {k: sum(w in v for w in words) for k, v in PRONOUNS.items()},
        'line_count': len(lines),
        'title_repeats': len(re.findall(rf'(?<![a-z0-9]){re.escape(title_core)}(?![a-z0-9])', norm(body)))
                         if title_core else 0,
    }


def main():
    profane = profanity_list()
    coverage = json.loads((ROOT / 'lyrics-coverage.json').read_text())  # from lyrics_dump.py
    out = {}
    for s in unique_songs():
        m = coverage.get(s['id']) or {'found': False}
        rec = {'lyrics': {'source': 'lrclib-dump', 'match': m['match']} if m['found'] else None}
        p = ROOT / 'cache' / 'lyrics' / f"{s['id']}.txt"
        if m['found'] and p.exists():
            rec['metrics'] = measure(s['title'], p.read_text(), profane)
        else:
            rec['metrics'] = None
        out[s['id']] = rec
    (ROOT / 'metrics.json').write_text(json.dumps({'meta': {
        'profanity_list': PROFANITY_URL, 'rhymes': 'CMU Pronouncing Dictionary via the pronouncing package'},
        'songs': out}, indent=1))
    print('metrics for', sum(bool(r['metrics']) for r in out.values()), 'of', len(out))


if __name__ == '__main__':
    main()
