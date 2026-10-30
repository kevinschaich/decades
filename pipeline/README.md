# Data pipeline

Builds the data behind Decades: every Billboard year-end singles chart from 1950 to 2025 plus 2026 so far,
artist genres, lyric measures and a per-song analysis. The original 2015 project was by Juhee Lee, Yinan Wen
and Kevin Schaich (see [`legacy/`](../legacy/)).

## What's published

Committed and free to build on: `songs.json`, `artists.json`, `genres.json`, `lyrics-coverage.json`,
`metrics.json`, `analysis.json`, `analysis/batch-*.json`, `galaxy.json`, and the app's `public/data/`.

**Not published:** lyrics and the dumps. `cache/` (the dumps, the matched lyrics in `cache/lyrics/`, fetched
pages) and `batches/` (the AI-pass inputs, which contain lyrics) are git-ignored. Lyrics are copyrighted and
are only read locally to produce the numbers and paraphrased summaries; no committed file contains lyric text.

## Setup

```sh
cd pipeline
python3 -m venv .venv && .venv/bin/pip install beautifulsoup4 lxml pronouncing numpy umap-learn
```

`songs.py` and `metrics.py` fetch pages through [Firecrawl](https://firecrawl.dev) (`fc.py`), which needs
`FIRECRAWL_API_KEY` in the repo's `.env` (git-ignored). Responses are cached in `cache/raw/` so re-runs are free.

Download the two dumps into `cache/dumps/`:

| Dump | Where | Size |
| --- | --- | --- |
| LRCLIB SQLite database | [lrclib.net/db-dumps](https://lrclib.net/db-dumps), `lrclib-db-dump-*.sqlite3.gz` saved as `lrclib.sqlite3.gz` | ~45 GB compressed, ~245 GB unpacked (`gunzip -k`) |
| MusicBrainz JSON artist dump | [data.metabrainz.org json-dumps](https://data.metabrainz.org/pub/musicbrainz/data/json-dumps/), latest `artist.tar.xz` | ~1.6 GB, streamed without unpacking |

## Steps

```sh
.venv/bin/python songs.py        # 1. songs.json
.venv/bin/python artists.py      # 2. artists.json, genres.json
.venv/bin/python lyrics_dump.py  # 3. cache/lyrics/, lyrics-coverage.json
.venv/bin/python metrics.py      # 4. metrics.json
.venv/bin/python batches.py      # 5. batches/
#                                  6. the AI pass → analysis/batch-*.json → analysis.json
.venv/bin/python galaxy.py       # 7. galaxy.json
cd .. && bun run data            # 8. public/data/
```

1. **`songs.py`**: Wikipedia's year-end chart pages (and billboard.com weekly charts for 2026), fetched
   through Firecrawl → `songs.json`: `songs[]` with `id`, `year`, `rank`, `title`, `artist` (as charted),
   `primary_artists`, `featured_artists` and `source`. `id` is a hash of the normalized title and first primary
   artist, so a song that charts in two years keeps one id.
2. **`artists.py`**: streams the MusicBrainz artist dump and keeps artists whose name or alias matches a
   charting artist (the best-documented one wins a name clash) → `artists.json`, keyed by the name as charted:
   MBID, type, gender, country, area, begin/end year, genres and top tags with vote counts. Also writes
   `genres.json`, the 15 genre groups.
3. **`lyrics_dump.py`**: matches every song to the LRCLIB dump offline, by normalized title and an artist
   match, preferring non-instrumental tracks with plain lyrics (it builds a title index,
   `cache/dumps/title-index.sqlite3`, ~1.5 GB, on first run). Lyrics go to `cache/lyrics/<id>.txt` (not
   published); `lyrics-coverage.json` records per song whether lyrics were found and how they matched. A few
   dozen misses were then matched, or marked instrumental, by hand-guided queries.
4. **`metrics.py`**: text measures from the cached lyrics → `metrics.json` (numbers only). The profanity list
   is fetched through Firecrawl.
5. **`batches.py`**: `batches/batch-NNN.jsonl`, 50 songs each with id, title, artist, year and lyrics, for the
   AI pass (not published).
6. **The AI pass**: one Claude (Haiku) agent per batch, following [`analysis-schema.md`](analysis-schema.md),
   writes `analysis/batch-NNN.json`; these are merged into `analysis.json`. Records hold judgements and
   paraphrase only, never lyric text.
7. **`galaxy.py`**: UMAP over each song's themes, mood, style, storytelling and explicitness → `galaxy.json`,
   a position in 0..1 per song plus the projection settings.
8. **`scripts/build-data.ts`** (runs before `bun dev` and `bun run build`): joins the files above into
   `public/data/songs.json` and `years.json`.

## Outputs in detail

- **`metrics.json`** (committed): per song id, `lyrics` (source and how it matched) and `metrics` (null when no lyrics were found):
  - `word_count`, `unique_words`, `lexical_diversity` (unique / total), `avg_word_length`, `line_count`
    (non-blank lines, section labels like `[Chorus]` removed)
  - `compression_ratio` (zlib level 9 compressed size / raw size; lower = more repetitive) and
    `repetition` (1 − that)
  - `rhyme_density`: share of lines whose last word rhymes with the last word of a line within three lines
    (CMU Pronouncing Dictionary rhyming part; the last three letters for words it lacks; a repeated word
    is not a rhyme)
  - `profanity_count`: words (and phrases) on the LDNOOBW English list
  - `pronouns`: counts for I / you / we / they, including their object, possessive and contracted forms
  - `title_repeats`: times the title (parentheticals and the B-side of a double A-side dropped) appears
- **`analysis.json`**: one record per song, as described in [`analysis-schema.md`](analysis-schema.md).

## Sources and methods

### Charts: Billboard via Wikipedia

- 1950–1956: "Billboard year-end top 30 singles of <year>"; 1957–1958: "…top 50 singles…"; 1959–2025:
  "Billboard Year-End Hot 100 singles of <year>". Rows come from the page's first wikitable with rank,
  title and artist columns, with rowspans expanded (ties keep their shared rank; 1958 lists 51 and 1969
  101 entries). Artists are split on "featuring" / "feat." / "with", using the cell's links to keep band
  names like "Bill Haley & His Comets" whole.
- **2026 is partial.** Billboard has no year-end chart yet, and Wikipedia's 2026 number-ones page lists only
  number ones, so 2026 is ranked from every weekly Hot 100 published so far on billboard.com: each week a song
  scores 101 − its position, scores are summed, and ties break by peak then weeks on chart. The top 100 are
  kept and marked `partial: true` with `points`, `weeks_on_chart` and `peak`; `songs.json` `meta.partial_2026`
  lists the weeks used. Without Wikipedia's links, 2026 artists are split on commas, " & " and " x ".
- Chart data is Billboard's; Wikipedia's text is CC BY-SA 4.0.

### Lyrics: LRCLIB

[LRCLIB](https://lrclib.net) is a crowd-sourced lyrics database that publishes full dumps. Matching runs
entirely offline against the dump. The lyrics stay with their rights holders, which is why they are only
cached locally.

### Artists and genres: MusicBrainz

The [MusicBrainz](https://musicbrainz.org) JSON artist dump; MusicBrainz core data is **CC0**. The 2015
project's 15 aggregate genres (`legacy/data/aggregate_genres.py`) are kept, in `artists.py`, with a few
MusicBrainz genre names added (rock and roll, doo-wop, trap, contemporary r&b…). An artist's genres are every
group its genres and tags fall in, most-voted first.

### Profanity and rhymes

- [LDNOOBW English list](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words)
  (CC BY 4.0), fetched through Firecrawl.
- CMU Pronouncing Dictionary (BSD-style license) via the `pronouncing` package.

## What changed from 2015

- The r/datasets Billboard CSV link is dead → Wikipedia's year-end pages, now through 2025.
- LyricWikia (closed 2020) and the Heroku lyric API are gone → the LRCLIB dump.
- `musicbrainzngs` API calls → the MusicBrainz JSON dump.
- Spotify audio features are no longer available.
