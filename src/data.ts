// Loads public/data once and decodes it into friendly, typed objects. Tabs use useData() and the helpers below and
// never touch the short keys in schema.ts.
import { useEffect, useState } from 'react'
import {
    ADDRESSEES, ARCS, EMOTIONS, EXPLICIT_TOPICS, GENDERS, GENRES, METRICS, NARRATORS, STYLES, THEMES, TIMEFRAMES,
    type Emotion, type Genre, type Metric, type RawSongs, type RawYear, type Style, type Theme,
} from './schema'

export * from './schema'
export { THEME_LABELS, THEME_COLORS, THEME_GROUPS, EMOTION_COLORS, EMOTION_LABELS, GENRE_COLORS, GENRE_LABELS, DECADES, DECADE_COLORS } from './theme'

export type Artist = { name: string; country?: string; kind?: string; begin?: number; genres: Genre[]; songs: Song[] }

export type Analysis = {
    summary: string
    themes: { theme: Theme; weight: number }[] // strongest first
    weights: Record<Theme, number> // every theme, 0 when absent
    primaryTheme: Theme | null
    valence: number // -1..1
    energy: number // 0..1
    emotion: Emotion
    secondaryEmotion: Emotion | null
    narrator: (typeof NARRATORS)[number]
    addressee: (typeof ADDRESSEES)[number]
    narratorGender: (typeof GENDERS)[number]
    storytelling: number
    arc: (typeof ARCS)[number]
    timeFrame: (typeof TIMEFRAMES)[number]
    style: Record<Style, number>
    explicitness: 0 | 1 | 2 | 3
    explicitTopics: (typeof EXPLICIT_TOPICS)[number][]
    languages: string[]
    nonEnglishShare: number
    references: { places: string[]; brands: string[]; technology: string[]; people: string[]; eras: string[] }
    eraSignal: number
    confidence: number
}

export type Song = {
    id: string
    title: string
    artist: string // as charted, e.g. "Nat King Cole with Nelson Riddle"
    primaryArtists: Artist[]
    featuredArtists: Artist[]
    charts: { year: number; rank: number }[] // oldest first
    year: number // first year it charted
    decade: number
    bestRank: number
    genres: Genre[] // most-voted first
    genre: Genre | null
    analysis: Analysis | null // null when no usable lyrics were found
    metrics: Record<Metric, number> | null
    galaxy: [number, number] | null // 0..1 each
}

export type Year = Omit<RawYear, 'themes' | 'primaryThemes' | 'emotions' | 'styles' | 'narrators' | 'addressees' | 'genders' | 'arcs' | 'genres' | 'metrics'> & {
    decade: number
    themes: Record<Theme, number>
    primaryThemes: Record<Theme, number>
    emotions: Record<Emotion, number>
    styles: Record<Style, number>
    narrators: Record<(typeof NARRATORS)[number], number>
    addressees: Record<(typeof ADDRESSEES)[number], number>
    genders: Record<(typeof GENDERS)[number], number>
    arcs: Record<(typeof ARCS)[number], number>
    genres: Record<Genre, number>
    metrics: Record<Metric, number>
}

export type Data = {
    songs: Song[]
    years: Year[]
    artists: Artist[]
    song: (id: string) => Song | undefined
    artist: (name: string) => Artist | undefined
    year: (y: number) => Year | undefined
    /** Songs that charted in a year, by rank. */
    chart: (y: number) => { song: Song; rank: number }[]
    firstYear: number
    lastYear: number
}

export const decadeOf = (year: number) => Math.floor(year / 10) * 10
export const decadeLabel = (d: number) => `${String(d).slice(2)}s` // 1980 → "80s"
const zip = <K extends string>(keys: readonly K[], vals: number[]) => Object.fromEntries(keys.map((k, i) => [k, vals[i] ?? 0])) as Record<K, number>

function decode(raw: RawSongs, rawYears: RawYear[]): Data {
    const artists: Artist[] = raw.artists.map((a) => ({
        name: a.n, country: a.c, kind: a.k, begin: a.b ? Number(a.b) : undefined, genres: (a.g ?? []).map((g) => GENRES[g]), songs: [],
    }))
    const songs: Song[] = raw.songs.map((s) => {
        const charts = s.c.map(([year, rank]) => ({ year, rank })).sort((a, b) => a.year - b.year)
        const genres = (s.g ?? []).map((g) => GENRES[g])
        let analysis: Analysis | null = null
        if (s.th && s.m && s.e && s.v && s.n && s.y) {
            const themes = s.th.map(([t, weight]) => ({ theme: THEMES[t], weight }))
            const r = s.r ?? {}
            analysis = {
                summary: s.s ?? '',
                themes,
                weights: zip(THEMES, THEMES.map((t) => themes.find((x) => x.theme === t)?.weight ?? 0)),
                primaryTheme: themes[0]?.theme ?? null,
                valence: s.m[0], energy: s.m[1],
                emotion: EMOTIONS[s.e[0]], secondaryEmotion: s.e[1] == null ? null : EMOTIONS[s.e[1]],
                narrator: NARRATORS[s.v[0]], addressee: ADDRESSEES[s.v[1]], narratorGender: GENDERS[s.v[2]],
                storytelling: s.n[0], arc: ARCS[s.n[1]], timeFrame: TIMEFRAMES[s.n[2]],
                style: zip(STYLES, s.y),
                explicitness: (s.x ?? 0) as Analysis['explicitness'],
                explicitTopics: (s.xt ?? []).map((i) => EXPLICIT_TOPICS[i]),
                languages: s.l ?? ['en'], nonEnglishShare: s.ne ?? 0,
                references: { places: r.pl ?? [], brands: r.br ?? [], technology: r.te ?? [], people: r.pe ?? [], eras: r.er ?? [] },
                eraSignal: s.es ?? 0, confidence: s.cf ?? 0,
            }
        }
        const song: Song = {
            id: s.i, title: s.t, artist: s.a,
            primaryArtists: s.p.map((i) => artists[i]), featuredArtists: (s.f ?? []).map((i) => artists[i]),
            charts, year: charts[0].year, decade: decadeOf(charts[0].year), bestRank: Math.min(...charts.map((c) => c.rank)),
            genres, genre: genres[0] ?? null, analysis,
            metrics: s.w ? zip(METRICS, s.w) : null,
            galaxy: s.gx ?? null,
        }
        for (const a of song.primaryArtists) a.songs.push(song)
        return song
    })
    const years: Year[] = rawYears.map((y) => ({
        ...y, decade: decadeOf(y.year),
        themes: zip(THEMES, y.themes), primaryThemes: zip(THEMES, y.primaryThemes), emotions: zip(EMOTIONS, y.emotions),
        styles: zip(STYLES, y.styles), narrators: zip(NARRATORS, y.narrators), addressees: zip(ADDRESSEES, y.addressees),
        genders: zip(GENDERS, y.genders), arcs: zip(ARCS, y.arcs), genres: zip(GENRES, y.genres), metrics: zip(METRICS, y.metrics),
    }))
    const songById = new Map(songs.map((s) => [s.id, s]))
    const artistByName = new Map(artists.map((a) => [a.name.toLowerCase(), a]))
    const yearByYear = new Map(years.map((y) => [y.year, y]))
    const charts = new Map<number, { song: Song; rank: number }[]>()
    for (const song of songs) for (const c of song.charts) {
        if (!charts.has(c.year)) charts.set(c.year, [])
        charts.get(c.year)!.push({ song, rank: c.rank })
    }
    for (const list of charts.values()) list.sort((a, b) => a.rank - b.rank)
    return {
        songs, years, artists,
        song: (id) => songById.get(id),
        artist: (name) => artistByName.get(name.toLowerCase()),
        year: (y) => yearByYear.get(y),
        chart: (y) => charts.get(y) ?? [],
        firstYear: years[0].year,
        lastYear: years[years.length - 1].year,
    }
}

let promise: Promise<Data> | null = null
/** Fetches and decodes the data once; every caller shares the same promise. */
export function loadData(): Promise<Data> {
    promise ??= Promise.all([
        fetch('data/songs.json').then((r) => r.json() as Promise<RawSongs>),
        fetch('data/years.json').then((r) => r.json() as Promise<RawYear[]>),
    ]).then(([s, y]) => decode(s, y))
    return promise
}

/** The decoded data, or null while it loads. */
export function useData(): Data | null {
    const [data, setData] = useState<Data | null>(null)
    useEffect(() => {
        let live = true
        loadData().then((d) => live && setData(d))
        return () => {
            live = false
        }
    }, [])
    return data
}

/** Group anything with a year into decades, oldest first. */
export function byDecade<T>(items: T[], yearOf: (t: T) => number): { decade: number; items: T[] }[] {
    const m = Map.groupBy(items, (t) => decadeOf(yearOf(t)))
    return [...m].sort((a, b) => a[0] - b[0]).map(([decade, items]) => ({ decade, items }))
}

/** Averages a per-year Record over a set of years, weighting each year by its analyzed songs. */
export function averageYears<K extends string>(years: Year[], pick: (y: Year) => Record<K, number>): Record<K, number> {
    const out = {} as Record<K, number>
    let total = 0
    for (const y of years) {
        const w = y.analyzed
        total += w
        for (const [k, v] of Object.entries(pick(y)) as [K, number][]) out[k] = (out[k] ?? 0) + v * w
    }
    for (const k in out) out[k] /= total || 1
    return out
}

export type { Emotion, Genre, Metric, Style, Theme }
