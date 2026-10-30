// Joins the pipeline's outputs into the compact static files the app loads (public/data/songs.json, years.json).
// Runs before every dev start and build, so public/data is generated, never committed. No lyric text goes in:
// only ids, chart positions, Claude's judgements and paraphrased summaries, metrics and the galaxy layout.
import { mkdirSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import {
    ADDRESSEES, ARCS, EMOTIONS, EXPLICIT_TOPICS, GENDERS, GENRES, NARRATORS, STYLES, THEMES, TIMEFRAMES,
    type RawArtist, type RawSong, type RawYear,
} from '../src/schema'

const P = new URL('../pipeline/', import.meta.url).pathname
const OUT = new URL('../public/data/', import.meta.url).pathname
const read = (f: string) => Bun.file(P + f).json()

type Chart = { id: string; year: number; rank: number; title: string; artist: string; primary_artists: string[]; featured_artists: string[]; partial?: boolean }
type Tag = { name: string; count: number }
type Artist = { mbName?: string; type?: string; country?: string; begin?: string; genres?: Tag[]; tags?: Tag[] }

const [chartFile, analysis, metricsFile, artistsFile, galaxy, genreFile] = await Promise.all([
    read('songs.json'), read('analysis.json'), read('metrics.json'), read('artists.json'), read('galaxy.json'), read('genres.json'),
])
const charts: Chart[] = chartFile.songs
const artistsInfo: Record<string, Artist> = artistsFile
const genreNames: Record<string, string[]> = genreFile.names
const byId = new Map<string, any>(analysis.map((r: any) => [r.id, r]))
const metrics: Record<string, any> = metricsFile.songs
const points: Record<string, [number, number]> = galaxy.points

const r2 = (n: number) => Math.round(n * 100) / 100
const r3 = (n: number) => Math.round(n * 1000) / 1000
const idx = <T extends string>(list: readonly T[], v: unknown) => {
    const i = list.indexOf(v as T)
    return i < 0 ? list.length - 1 : i // unknown values fall back to the last entry (unspecified / flat / mixed …)
}

// Genres of an artist: its MusicBrainz genres and tags, most-voted first, mapped to the 15 aggregate genres.
function artistGenres(a: Artist | undefined): number[] {
    if (!a) return []
    const tags = [...(a.genres ?? []), ...(a.tags ?? [])].sort((x, y) => y.count - x.count)
    const out: number[] = []
    for (const t of tags) {
        const name = t.name.toLowerCase().trim()
        GENRES.forEach((g, i) => {
            if (genreNames[g]?.includes(name) && !out.includes(i)) out.push(i)
        })
    }
    return out
}

// Artists table
const artists: RawArtist[] = []
const artistIndex = new Map<string, number>()
const artistOf = (name: string) => {
    let i = artistIndex.get(name)
    if (i === undefined) {
        const a = artistsInfo[name]
        const g = artistGenres(a)
        const row: RawArtist = { n: name }
        if (a?.country) row.c = a.country
        if (a?.type) row.k = a.type
        if (a?.begin) row.b = a.begin.slice(0, 4)
        if (g.length) row.g = g
        i = artists.push(row) - 1
        artistIndex.set(name, i)
    }
    return i
}

// Songs: one row per id, with every [year, rank] it charted
const songs = new Map<string, RawSong>()
for (const c of charts) {
    let s = songs.get(c.id)
    if (s) {
        s.c.push([c.year, c.rank])
        continue
    }
    s = { i: c.id, t: c.title, a: c.artist, p: c.primary_artists.map(artistOf), c: [[c.year, c.rank]] }
    if (c.featured_artists.length) s.f = c.featured_artists.map(artistOf)
    const g: number[] = []
    for (const p of s.p) for (const x of artists[p].g ?? []) if (!g.includes(x)) g.push(x)
    if (g.length) s.g = g

    const r = byId.get(c.id)
    if (r?.lyricsUsable) {
        s.s = r.summary
        s.th = Object.entries(r.themes ?? {})
            .filter(([k]) => THEMES.includes(k as any))
            .sort((a: any, b: any) => b[1] - a[1])
            .map(([k, w]) => [THEMES.indexOf(k as any), r2(w as number)])
        s.m = [r2(r.mood?.valence ?? 0), r2(r.mood?.energy ?? 0)]
        const sec = r.mood?.secondaryEmotion
        s.e = [idx(EMOTIONS, r.mood?.primaryEmotion), sec && EMOTIONS.includes(sec) ? EMOTIONS.indexOf(sec) : null]
        s.v = [idx(NARRATORS, r.perspective?.narrator), idx(ADDRESSEES, r.perspective?.addressee), idx(GENDERS, r.perspective?.narratorGender)]
        s.n = [r2(r.narrative?.storytelling ?? 0), idx(ARCS, r.narrative?.arc), idx(TIMEFRAMES, r.narrative?.timeFrame)]
        s.y = STYLES.map((k) => r2(r.style?.[k] ?? 0))
        s.x = r.explicitness ?? 0
        const xt = (r.explicitTopics ?? []).map((t: string) => EXPLICIT_TOPICS.indexOf(t as any)).filter((i: number) => i >= 0)
        if (xt.length) s.xt = xt
        const langs: string[] = r.languages ?? ['en']
        if (!(langs.length === 1 && langs[0] === 'en')) s.l = langs
        if (r.nonEnglishShare) s.ne = r2(r.nonEnglishShare)
        const ref = r.references ?? {}
        const refs: NonNullable<RawSong['r']> = {}
        for (const [k, short] of [['places', 'pl'], ['brands', 'br'], ['technology', 'te'], ['people', 'pe'], ['eras', 'er']] as const)
            if (ref[k]?.length) refs[short] = ref[k]
        if (Object.keys(refs).length) s.r = refs
        s.es = r2(r.eraSignal ?? 0)
        s.cf = r2(r.confidence ?? 0)
    }
    const m = metrics[c.id]?.metrics
    if (m) {
        const p = m.pronouns ?? {}
        s.w = [m.word_count, m.unique_words, r3(m.lexical_diversity), r3(m.repetition), r3(m.rhyme_density), r2(m.avg_word_length),
            m.profanity_count, m.line_count, m.title_repeats, p.i ?? 0, p.you ?? 0, p.we ?? 0, p.they ?? 0]
    }
    if (points[c.id]) s.gx = points[c.id]
    songs.set(c.id, s)
}

// Years
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const shares = (vals: number[], n: number) => {
    const out = new Array(n).fill(0)
    for (const v of vals) out[v]++
    return out.map((x) => r3(vals.length ? x / vals.length : 0))
}
const years: RawYear[] = []
const entriesByYear = Map.groupBy(charts, (c) => c.year)
for (const [year, entries] of [...entriesByYear].sort((a, b) => a[0] - b[0])) {
    const all = entries.map((c) => songs.get(c.id)!)
    const an = all.filter((s) => s.th)
    const withMetrics = all.filter((s) => s.w)
    const genreShare = new Array(GENRES.length).fill(0)
    for (const s of all) for (const g of s.g ?? []) genreShare[g]++
    years.push({
        year,
        ...(entries.some((c) => c.partial) ? { partial: true } : {}),
        songs: all.length,
        analyzed: an.length,
        themes: THEMES.map((_, t) => r3(mean(an.map((s) => s.th!.find(([i]) => i === t)?.[1] ?? 0)))),
        primaryThemes: shares(an.filter((s) => s.th!.length).map((s) => s.th![0][0]), THEMES.length),
        emotions: shares(an.map((s) => s.e![0]), EMOTIONS.length),
        valence: r3(mean(an.map((s) => s.m![0]))),
        energy: r3(mean(an.map((s) => s.m![1]))),
        styles: STYLES.map((_, k) => r3(mean(an.map((s) => s.y![k])))),
        storytelling: r3(mean(an.map((s) => s.n![0]))),
        eraSignal: r3(mean(an.map((s) => s.es!))),
        explicitness: r3(mean(an.map((s) => s.x!))),
        explicitShare: r3(an.length ? an.filter((s) => s.x! >= 2).length / an.length : 0),
        narrators: shares(an.map((s) => s.v![0]), NARRATORS.length),
        addressees: shares(an.map((s) => s.v![1]), ADDRESSEES.length),
        genders: shares(an.map((s) => s.v![2]), GENDERS.length),
        arcs: shares(an.map((s) => s.n![1]), ARCS.length),
        genres: genreShare.map((x) => r3(x / all.length)),
        metrics: withMetrics.length ? withMetrics[0].w!.map((_, k) => r3(mean(withMetrics.map((s) => s.w![k])))) : [],
        nonEnglish: r3(mean(an.map((s) => s.ne ?? 0))),
    })
}

mkdirSync(OUT, { recursive: true })
for (const [name, data] of [['songs.json', { artists, songs: [...songs.values()] }], ['years.json', years]] as const) {
    const text = JSON.stringify(data)
    writeFileSync(OUT + name, text)
    console.log(`${name}: ${(text.length / 1e6).toFixed(2)} MB, ${(gzipSync(text).length / 1e6).toFixed(2)} MB gzipped`)
}
