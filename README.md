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
| Lyrics, read but never shown | [LRCLIB](https://lrclib.net) | Lyrics belong to their rights holders |
| Artists, genres and tags | [MusicBrainz](https://musicbrainz.org) | CC0 |
| Themes, moods and summaries | Analysis by [Claude](https://www.anthropic.com/claude) | Generated for this project |
| Profanity word list | [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) | CC BY 4.0 |
| Pronunciations for rhymes | [CMU Pronouncing Dictionary](http://www.speech.cs.cmu.edu/cgi-bin/cmudict) | BSD-style |
| Original project and genre groups | Juhee Lee, Yinan Wen and Kevin Schaich ([`legacy/`](legacy/)) | MIT |

## Run locally

```sh
bun install && bun dev
```
