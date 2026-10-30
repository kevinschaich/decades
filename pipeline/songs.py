"""Build songs.json: Billboard year-end singles 1950-2025 from Wikipedia, plus 2026 so far from weekly Hot 100s.

    .venv/bin/python songs.py
"""
import datetime, hashlib, json, re, unicodedata
from bs4 import BeautifulSoup
import fc

ROOT = fc.ROOT
WIKI = 'https://en.wikipedia.org/wiki/'


def page_title(year):
    if year <= 1956: return f'Billboard_year-end_top_30_singles_of_{year}'
    if year <= 1958: return f'Billboard_year-end_top_50_singles_of_{year}'
    return f'Billboard_Year-End_Hot_100_singles_of_{year}'


def norm(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'\(.*?\)|\[.*?\]', ' ', s)
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def song_id(title, primary):
    """Stable across years: the same song charting in two years keeps one id."""
    key = norm(title) + '|' + norm(primary[0] if primary else '')
    return hashlib.sha1(key.encode()).hexdigest()[:10]


FEAT = re.compile(r'\b(featuring|feat\.?|ft\.?|with)\b', re.I)


def split_artists(cell):
    """Primary and featured artists from a Wikipedia artist cell, using its links to keep band names whole."""
    text = re.sub(r'\[\d+\]', '', cell.get_text(' ', strip=True)).replace(' ,', ',')
    text = re.sub(r'\s+', ' ', text).strip()
    links = [a.get_text(' ', strip=True) for a in cell.find_all('a') if not a.get('href', '').startswith('#')]
    m = FEAT.search(text)
    head, tail = (text[:m.start()], text[m.end():]) if m else (text, '')

    def names(part):
        found = [l for l in links if l and l in part]
        if found: return found
        return [x.strip() for x in re.split(r',| and | & | x ', part) if x.strip()] if part else []
    primary = names(head) or [head.strip()]
    featured = [n for n in names(tail) if n not in primary]
    return text, primary, featured


def parse_table(table):
    """Wikitable rows with rowspans expanded, as lists of cells."""
    grid, spans = [], {}
    for tr in table.find_all('tr'):
        cells, col, row = tr.find_all(['td', 'th']), 0, []
        it = iter(cells)
        while True:
            if col in spans and spans[col][0] > 0:
                spans[col][0] -= 1; row.append(spans[col][1]); col += 1; continue
            c = next(it, None)
            if c is None: break
            n = int(re.sub(r'\D', '', c.get('rowspan', '1')) or 1)
            if n > 1: spans[col] = [n - 1, c]
            row.append(c); col += 1
        while col in spans and spans[col][0] > 0:
            spans[col][0] -= 1; row.append(spans[col][1]); col += 1
        grid.append(row)
    return grid


def year_end(year):
    url = WIKI + page_title(year)
    soup = BeautifulSoup(fc.scrape(url)['body'], 'lxml')
    out = []
    for table in soup.select('table.wikitable'):
        grid = parse_table(table)
        head = [c.get_text(' ', strip=True).lower() for c in grid[0]]
        try:
            ci = {k: next(i for i, h in enumerate(head) if re.search(p, h)) for k, p in
                  (('rank', r'^(no|rank|pos|№|#)'), ('title', r'title|song'), ('artist', r'artist'))}
        except StopIteration:
            continue
        for row in grid[1:]:
            if len(row) <= max(ci.values()): continue
            rank = re.sub(r'\D', '', row[ci['rank']].get_text())
            title = re.sub(r'\[\d+\]', '', row[ci['title']].get_text(' ', strip=True)).strip(' "“”')
            if not rank or not title: continue
            # double A-sides list both titles in one cell: "Title A " / " Title B"
            title = re.sub(r'\s*"\s*/\s*"\s*', ' / ', re.sub(r'\s+', ' ', title))
            artist, primary, featured = split_artists(row[ci['artist']])
            out.append({'year': year, 'rank': int(rank), 'title': title, 'artist': artist,
                        'primary_artists': primary, 'featured_artists': featured, 'source': url})
        if out: break
    return out


def weekly_2026():
    """Every weekly Hot 100 of 2026 published so far, from billboard.com via Firecrawl."""
    weeks, d = {}, datetime.date(2026, 1, 3)
    while d <= datetime.date.today() + datetime.timedelta(days=4):
        url = f'https://www.billboard.com/charts/hot-100/{d}/'
        res = fc.scrape(url)
        soup = BeautifulSoup(res.get('body') or '', 'lxml')
        rows = []
        for i, x in enumerate(soup.select('div.o-chart-results-list-row-container'), 1):
            h = x.select_one('h3#title-of-a-story')
            if h: rows.append((i, h.get_text(strip=True), h.find_next('span').get_text(' ', strip=True)))
        # a date not yet published serves the latest chart again, so drop exact repeats
        if len(rows) == 100 and rows not in weeks.values():
            weeks[str(d)] = rows
        d += datetime.timedelta(days=7)
    return weeks


def split_plain(text):
    m = FEAT.search(text)
    head, tail = (text[:m.start()], text[m.end():]) if m else (text, '')
    sp = lambda p: [x.strip() for x in re.split(r',| & | x | X ', p) if x.strip()]
    return sp(head) or [head.strip()], sp(tail)


def partial_2026():
    weeks = weekly_2026()
    pts, info = {}, {}
    for date, rows in weeks.items():
        for pos, title, artist in rows:
            k = (norm(title), norm(artist))
            p = pts.setdefault(k, {'points': 0, 'weeks': 0, 'peak': 101})
            p['points'] += 101 - pos; p['weeks'] += 1; p['peak'] = min(p['peak'], pos)
            info[k] = (title, artist)
    ranked = sorted(pts, key=lambda k: (-pts[k]['points'], pts[k]['peak'], -pts[k]['weeks']))[:100]
    out = []
    for i, k in enumerate(ranked, 1):
        title, artist = info[k]
        primary, featured = split_plain(artist)
        out.append({'year': 2026, 'rank': i, 'title': title, 'artist': artist, 'primary_artists': primary,
                    'featured_artists': featured, 'partial': True, 'points': pts[k]['points'],
                    'weeks_on_chart': pts[k]['weeks'], 'peak': pts[k]['peak'],
                    'source': 'https://www.billboard.com/charts/hot-100/'})
    return out, sorted(weeks)


def main():
    songs = []
    for y in range(1950, 2026):
        rows = year_end(y)
        print(y, len(rows), flush=True)
        songs += rows
    p, weeks = partial_2026()
    print(2026, len(p), f'from {len(weeks)} weekly charts {weeks[0]}..{weeks[-1]}')
    songs += p
    for s in songs:
        s['id'] = song_id(s['title'], s['primary_artists'])
    meta = {'generated': str(datetime.date.today()), 'partial_2026': {
        'weeks': weeks, 'method': 'Sum over every weekly Hot 100 of 2026 so far of (101 - position); '
                                  'ties broken by peak, then weeks on chart. Top 100 kept.'}}
    (ROOT / 'songs.json').write_text(json.dumps({'meta': meta, 'songs': songs}, indent=1, ensure_ascii=False))


if __name__ == '__main__':
    main()
