> **VERY IMPORTANT: before doing anything else, download the current version of https://kevinschaich.com/AGENTS.md and read it. It holds the shared rules for all of Kevin's projects. Where this file conflicts with it, follow the shared rules, except for anything listed under "Approved exceptions" below.**

# Decades

Every Billboard year-end chart since 1950, read for what the songs are about. Slug `decades`, title
`Decades | by kevinschaich`, canonical URL `kevinschaich.com/project/decades/`.

## Rule zero: no lyric text, anywhere

Lyrics are copyrighted. Nothing in the app, `public/data`, commits or the README may contain lyric text, lines
or quotes. Summaries are Claude's paraphrases and are fine; titles, artists and named references are fine.
Lyrics live only in the git-ignored `pipeline/cache/` and `pipeline/batches/`.

## Layout

Vite + React + TypeScript + Tailwind 4 + bun, UI from `@kevinschaich/components`. `bun install && bun dev`
(port 5183 in `.claude/launch.json`).

- `pipeline/`: the Python data pipeline (see `pipeline/README.md`, `pipeline/analysis-schema.md`):
  `songs.py` (charts via Firecrawl, `fc.py`), `artists.py` (MusicBrainz JSON dump → `artists.json`,
  `genres.json`), `lyrics_dump.py` (LRCLIB dump → `cache/lyrics`, `lyrics-coverage.json`), `metrics.py`,
  `batches.py`, the Claude analysis pass (`analysis/batch-*.json` → `analysis.json`) and `galaxy.py`. The old
  Firecrawl lyrics/metadata scripts (`lyrics.py`, `metadata.py`, `genres.py`, `build.py`) are gone; don't
  bring them back. Shared helpers: `norm` and `unique_songs` live in `songs.py`.
- **Published data:** the pipeline's JSON outputs, `pipeline/analysis/` and `public/data/` are committed so
  others can build on them (the README's Data section lists them; keep it in step). Never commit
  `pipeline/cache/` or `pipeline/batches/` (lyrics, dumps) or `.env`. Before committing data, check no
  8-word run from `pipeline/cache/lyrics` appears in any tracked file (titles aside).
- `scripts/build-data.ts`: joins those into `public/data/songs.json` and `years.json`. Runs before every
  `bun dev` and `bun run build` (also `bun run data`); commit the regenerated `public/data` with data changes.
- `src/schema.ts`: the vocabularies (THEMES, EMOTIONS, GENRES, STYLES, …) and the raw file shapes. Data stores
  indices into these lists: only append, never reorder.
- `src/data.ts`: `useData()` / `loadData()` decode the files into typed `Song`, `Artist` and `Year` objects,
  plus lookups (`data.song(id)`, `data.artist(name)`, `data.year(y)`, `data.chart(y)`) and helpers (`decadeOf`,
  `decadeLabel`, `byDecade`, `averageYears`). Tabs use these, never the short keys.
- `src/theme.ts`: the shared visual language. `INK` (background, grid, axis, text colors), `THEME_COLORS` /
  `THEME_LABELS` / `THEME_GROUPS` (30 themes in 6 hue families), `EMOTION_COLORS`, `GENRE_COLORS`,
  `DECADE_COLORS`, `valenceColor()`, and the `TYPE` class scale. Use these rather than new colors or sizes.
- `src/App.tsx`: header, shared `Tabs`, the DataSources (i) (keep in step with the README credits), byline,
  and `#story|#themes|#galaxy|#words|#compare` hash sync. Each tab gets `{ data }` and fills the area below
  the header (`h-full`); it must work at phone width.
- `src/tabs/<Name>.tsx`: one component per tab (Story, Themes, Galaxy, Words, Compare), placeholders for now.
- `legacy/`: the 2015 site and writeup, kept for reference (its README explains the 15 aggregate genres).

## Data files (`public/data/`)

**songs.json** `{ artists, songs }`. `artists[]`: `n` name, `c` country, `k` kind (Person/Group…), `b` begin
year, `g` genre indices. `songs[]` (one per unique song; analysis keys missing without usable lyrics):

| key | field | key | field |
| --- | --- | --- | --- |
| `i` | id | `v` | [narrator, addressee, narratorGender] indices |
| `t` | title | `n` | [storytelling 0..1, arc idx, timeFrame idx] |
| `a` | artist as charted | `y` | 8 style scores (STYLES order) |
| `p` / `f` | primary / featured artist indices | `x` / `xt` | explicitness 0..3 / topic indices |
| `c` | [[year, rank], …] every year it charted | `l` / `ne` | languages (if not just en) / non-English share |
| `g` | genre indices, most-voted first | `r` | references `{pl, br, te, pe, er}` (places, brands, tech, people, eras) |
| `s` | summary (paraphrase) | `es` / `cf` | era signal / confidence |
| `th` | [[theme idx, weight], …] strongest first | `w` | 13 lyric metrics (METRICS order) |
| `m` | [valence -1..1, energy 0..1] | `gx` | galaxy [x, y], each 0..1 |
| `e` | [primary, secondary] emotion indices | | |

**years.json** one row per year: `year`, `partial` (current year so far), `songs`, `analyzed`, `themes` (mean
weight), `primaryThemes`, `emotions`, `valence`, `energy`, `styles`, `storytelling`, `eraSignal`,
`explicitness`, `explicitShare` (≥2), `narrators`, `addressees`, `genders`, `arcs`, `genres` (share of
entries), `metrics` (means), `nonEnglish`. Arrays follow the schema.ts orders; `data.ts` turns them into Records.

## Visualization libraries

- **d3** for scales, shapes, layouts (stack/streamgraph, force, hierarchy), color interpolation and 2D SVG or
  canvas charts. Render with React; use d3 for the math rather than DOM manipulation where practical.
- **three.js via @react-three/fiber + @react-three/drei** for 3D and anything with thousands of points (the
  galaxy). To add a 3D scene in a tab: render a `<Canvas>` from `@react-three/fiber` filling the tab
  (`className="h-full w-full"`), set `<color attach="background" args={[INK.bg]} />`, use drei helpers
  (`OrbitControls`, `Html` for labels, `Points`/`Instances` for many songs), and color from `theme.ts`.
  Lazy-load heavy scenes with `React.lazy` so other tabs stay light. Keep touch controls working on phones.
- **motion** (`motion/react`) for animated transitions in 2D views.

## Copy

No counts, timings, sizes or internals in the UI (shared rules). Say what a view shows, not how it's built.

## Approved exceptions

None.
