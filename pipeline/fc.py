"""Firecrawl client. Every third-party page or API is fetched through Firecrawl, never directly.

Responses are cached in cache/raw/<sha1>.json (git-ignored) so re-runs cost nothing.
"""
import hashlib, json, os, time, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).parent
CACHE = ROOT / 'cache' / 'raw'
CACHE.mkdir(parents=True, exist_ok=True)
API = 'https://api.firecrawl.dev/v1'
for line in (ROOT.parent / '.env').read_text().splitlines():
    k, _, v = line.partition('=')
    if k.strip(): os.environ.setdefault(k.strip(), v.strip())
KEY = os.environ['FIRECRAWL_API_KEY']


def call(method, path, body=None):
    for attempt in range(6):
        req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body else None,
                                     headers={'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'})
        try:
            return json.load(urllib.request.urlopen(req, timeout=180))
        except urllib.error.HTTPError as e:
            if e.code in (408, 429, 500, 502, 503) and attempt < 5:
                time.sleep(5 * (attempt + 1)); continue
            return {'success': False, 'error': f'{e.code} {e.read()[:300]!r}'}
        except Exception as e:
            if attempt < 5: time.sleep(5); continue
            return {'success': False, 'error': repr(e)}


def _path(url, fmt):
    return CACHE / (hashlib.sha1(f'{fmt} {url}'.encode()).hexdigest() + '.json')


def cached(url, fmt='rawHtml'):
    p = _path(url, fmt)
    return json.loads(p.read_text()) if p.exists() else None


def scrape(url, fmt='rawHtml', refresh=False):
    """Returns {'status': int, 'body': str} for one URL (rawHtml = the response body as served)."""
    p = _path(url, fmt)
    if p.exists() and not refresh:
        return json.loads(p.read_text())
    r = call('POST', '/scrape', {'url': url, 'formats': [fmt], 'onlyMainContent': False, 'maxAge': 0})
    if not r.get('success'):
        return {'status': 0, 'body': '', 'error': r.get('error')}
    d = r['data']
    out = {'status': (d.get('metadata') or {}).get('statusCode') or 0, 'body': d.get(fmt) or ''}
    if out['status'] in (200, 404):
        p.write_text(json.dumps(out))
    return out


def scrape_many(urls, fmt='rawHtml', chunk=1000):
    """Uncached URLs go through Firecrawl's batch scrape, which queues them server-side."""
    todo = [u for u in dict.fromkeys(urls) if not _path(u, fmt).exists()]
    for i in range(0, len(todo), chunk):
        part = todo[i:i + chunk]
        job = call('POST', '/batch/scrape', {'urls': part, 'formats': [fmt], 'onlyMainContent': False, 'maxAge': 0})
        if not job.get('success'):
            print('batch failed', job.get('error'), flush=True); continue
        while True:
            r = call('GET', f"/batch/scrape/{job['id']}")
            print(f"batch {i}: {r.get('status')} {r.get('completed')}/{r.get('total')}", flush=True)
            if r.get('status') in ('completed', 'failed', 'cancelled'): break
            time.sleep(15)
        page = r
        while True:
            for d in page.get('data') or []:
                meta = d.get('metadata') or {}
                src, st = meta.get('sourceURL') or meta.get('url'), meta.get('statusCode') or 0
                if src in part and st in (200, 404):
                    _path(src, fmt).write_text(json.dumps({'status': st, 'body': d.get(fmt) or ''}))
            if not page.get('next'): break
            page = call('GET', page['next'].replace(API, ''))
    return {u: scrape(u, fmt) for u in urls}


def json_body(res):
    """Firecrawl's rawHtml of a JSON API is the JSON text, sometimes wrapped in <pre> by the browser."""
    b = res.get('body') or ''
    s = b.find('{') if b.lstrip().startswith('<') else 0
    s2 = b.find('[') if b.lstrip().startswith('<') else 0
    if b.lstrip().startswith('<'):
        import html, re
        m = re.search(r'<pre[^>]*>(.*)</pre>', b, re.S) or re.search(r'<body[^>]*>(.*)</body>', b, re.S)
        b = html.unescape(m.group(1)) if m else b
    try:
        return json.loads(b)
    except Exception:
        return None
