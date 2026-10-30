[![Decades by kevinschaich](https://kevinschaich.com/og/decades.png)](https://kevinschaich.com/project/decades/)

# Decades

The story of us, told through the songs we loved most

**[Try it →](https://kevinschaich.com/project/decades/)**

## How it works

- Every Billboard year-end singles chart from 1950 to today, with each song's lyrics read for its themes,
  mood, perspective and style, and measured for vocabulary, repetition and rhyme.
- Five views: the story of each decade, the rise and fall of themes, a galaxy of songs placed by meaning,
  the words themselves, and side-by-side comparisons.
- Lyrics are only read, never shown or published. The data pipeline is in [`pipeline/`](pipeline/).
- A rebuild of a 2015 project by Juhee Lee, Yinan Wen and Kevin Schaich, kept in [`legacy/`](legacy/).

## Data sources

| What | From | License |
| --- | --- | --- |
| Year-end charts | [Billboard, via Wikipedia](https://en.wikipedia.org/wiki/Billboard_Year-End_Hot_100_singles_of_2025) | CC BY-SA 4.0 |
| This year's chart | [Billboard Hot 100](https://www.billboard.com/charts/hot-100/) | Chart positions for reference |
| Lyrics, read but never shown | [LRCLIB database dump](https://lrclib.net/db-dumps), matched offline | Lyrics belong to their rights holders |
| Artists, genres and tags | [MusicBrainz JSON artist dump](https://data.metabrainz.org/pub/musicbrainz/data/json-dumps/) | CC0 |
| Themes, moods and summaries | Analysis by [Claude](https://www.anthropic.com/claude) | Generated for this project |
| Profanity word list | [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) | CC BY 4.0 |
| Pronunciations for rhymes | [CMU Pronouncing Dictionary](http://www.speech.cs.cmu.edu/cgi-bin/cmudict) | BSD-style |
| Fetching pages (charts, word list) | [Firecrawl](https://firecrawl.dev) | Fetching only |
| Original project and genre groups | Juhee Lee, Yinan Wen and Kevin Schaich ([`legacy/`](legacy/)) | MIT |

## Data

The derived dataset is published in this repo so others can build on it:

- [`pipeline/songs.json`](pipeline/songs.json): every year-end chart entry (year, rank, title, artists).
- [`pipeline/artists.json`](pipeline/artists.json): each charting artist's MusicBrainz genres, tags, kind, country and start year.
- [`pipeline/genres.json`](pipeline/genres.json): the 15 genre groups and the MusicBrainz names in each.
- [`pipeline/lyrics-coverage.json`](pipeline/lyrics-coverage.json): whether lyrics were found for each song and how they matched (no lyric text).
- [`pipeline/metrics.json`](pipeline/metrics.json): vocabulary, repetition, rhyme, profanity and pronoun measures per song.
- [`pipeline/analysis.json`](pipeline/analysis.json): themes, mood, perspective, style, explicitness, references and a short paraphrased summary per song ([schema](pipeline/analysis-schema.md)).
- [`pipeline/analysis/`](pipeline/analysis/): the same analysis, as the batches it was produced in.
- [`pipeline/galaxy.json`](pipeline/galaxy.json): a 2D position per song, placing songs about similar things together.
- [`public/data/`](public/data/): all of the above joined into the compact files the app loads.

How each file is made is in [`pipeline/README.md`](pipeline/README.md).

## Copyright

Song titles, artist names and chart positions belong to their owners. Lyrics are copyrighted by their rights
holders. The new pipeline only reads them to produce the derived measures and summaries, and doesn't publish
them; the original 2015 project's data in [`legacy/`](legacy/) includes lyrics, used for research and commentary. The AI summaries are paraphrases. Charts via Wikipedia are CC BY-SA 4.0. MusicBrainz
data is CC0. If you're a rights holder with concerns, please
[open an issue](https://github.com/kevinschaich/decades/issues).

## Run locally

```sh
bun install && bun dev
```
