# Data pipeline

Builds the data behind the rebuilt Billboard lyrics project: every Billboard year-end singles chart from 1950
to 2025, 2026 so far, lyrics, MusicBrainz metadata and text metrics. The original 2015 project was by Juhee
Lee, Yinan Wen and Kevin Schaich (see the repo's `README.md`, `writeup.md` and `data-detail.md`).

## Run

```sh
cd pipeline
python3 -m venv .venv && .venv/bin/pip install beautifulsoup4 lxml pronouncing
.venv/bin/python songs.py      # songs.json
.venv/bin/python metadata.py   # cache/metadata.json, cache/artists.json (≥1 s between MusicBrainz requests)
.venv/bin/python lyrics.py     # cache/lyrics/, cache/lyrics_matches.json (after metadata, to match on duration)
.venv/bin/python metrics.py    # metrics.json
.venv/bin/python build.py      # merges metadata into songs.json, writes batches/, prints coverage
```

Needs `FIRECRAWL_API_KEY` in the repo's `.env` (git-ignored). **Every external page and API is fetched through
[Firecrawl](https://firecrawl.dev)** (`fc.py`), never directly, and each response is cached in `cache/raw/` so
re-runs are free. `cache/` and `batches/` are git-ignored: they hold lyrics, which are copyrighted. Nothing
committed contains lyric text.

## Outputs

- **`songs.json`** (committed): `songs[]` with `id`, `year`, `rank`, `title`, `artist` (as charted),
  `primary_artists`, `featured_artists`, `source`, and after `build.py` `musicbrainz` (recording and artist
  MBIDs, duration in seconds, first release date, earliest release's title/type/country, ISRCs),
  `artist_info` (type, country, begin date), `genres`, `tags` and `aggregate_genres`. `id` is a hash of the
  normalized title and first primary artist, so a song that charts in two years keeps one id.
- **`metrics.json`** (committed): per song id, the lyric match (`lrclib_id`, `match`, `duration_gap`) and
  `metrics` (null when no lyrics were found):
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
- **`batches/batch-NNN.jsonl`** (git-ignored): ~40 songs a line each with `id`, `title`, `artists`,
  `year` and `lyrics`, for the AI pass. Songs without lyrics are left out.

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

[LRCLIB](https://lrclib.net) `/api/search` by track and primary artist, then a free-text search as a
fallback. A candidate must match the title (≥0.8 similarity) and an artist (≥0.6); among those the best
title + artist score wins, less up to one point for a duration gap against MusicBrainz. `match` is `exact`
(normalized title and primary artist equal) or `fuzzy`, with `+duration` when within 5 s of MusicBrainz.
LRCLIB's database is crowd-sourced and free to use; the lyrics themselves stay with their rights holders,
which is why they are only cached locally.

### Metadata: MusicBrainz

[MusicBrainz](https://musicbrainz.org) web service (`/ws/2`), at most one request started per second as its
rate limit asks. Per song, a recording search by title and artist; the matching recording with the earliest
release (live, remix, demo, instrumental and karaoke versions skipped) gives the duration (median of the
earliest matches), release and ISRCs. Per primary artist, a lookup with genres and tags. MusicBrainz core data
is **CC0**. Labels are not included: they need a further release lookup per song. Spotify audio features are
no longer available and are skipped.

### Genres

The 2015 project's 15 aggregate genres (`data/aggregate_genres.py`) are kept, in `genres.py`, with a few
MusicBrainz genre names added (rock and roll, doo-wop, trap, contemporary r&b, dance-pop…). A song's
`aggregate_genres` are every bucket its recording tags, artist genres and artist tags fall in, the first
being the bucket of its most-voted tag.

### Profanity and rhymes

- [LDNOOBW English list](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words)
  (CC BY 4.0), fetched through Firecrawl.
- CMU Pronouncing Dictionary (BSD-style license) via the `pronouncing` package.

## What changed from 2015

- The r/datasets Billboard CSV link (ryanrishi.com) is dead → Wikipedia's year-end pages, now through 2025.
- LyricWikia (lyrics.wikia.com, closed 2020) and the Heroku lyric API are gone → LRCLIB.
- `musicbrainzngs` called MusicBrainz directly → the same API through Firecrawl.
- Spotify audio features (not used in 2015, but often suggested) are no longer available.

## Credits

- Chart positions: Billboard, via Wikipedia (CC BY-SA 4.0) and billboard.com for 2026.
- Lyrics: LRCLIB (lrclib.net), cached locally only.
- Metadata, genres and tags: MusicBrainz (CC0).
- Profanity list: LDNOOBW (CC BY 4.0). Pronunciations: CMU Pronouncing Dictionary.
- Original project and genre mapping: Juhee Lee, Yinan Wen and Kevin Schaich, 2015.
