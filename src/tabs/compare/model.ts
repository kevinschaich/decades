// The Compare tab's math: what a "subject" is (a decade, year, artist or genre), the features every analyzed song is
// measured on, each subject's profile, what makes one subject distinct from the others, and its most typical songs.
import { ADDRESSEES, EMOTIONS, NARRATORS, STYLES, decadeOf, type Analysis, type Data, type Genre, type Song } from '../../data'
import { EMOTION_COLORS, EMOTION_LABELS, GENRE_LABELS, INK, THEME_COLORS, THEME_GROUPS, THEME_LABELS } from '../../theme'

export type Kind = 'decade' | 'year' | 'artist' | 'genre'
export type Subject = { kind: Kind; key: string }
export const subjectId = (s: Subject) => `${s.kind}:${s.key}`

/** Glowing, well-separated colors for up to three subjects side by side. */
export const SUBJECT_COLORS = ['oklch(0.8 0.13 215)', 'oklch(0.72 0.2 355)', 'oklch(0.86 0.15 88)'] as const

export function subjectLabel(s: Subject): string {
    if (s.kind === 'decade') return `The ${s.key}s`
    if (s.kind === 'genre') return GENRE_LABELS[s.key as Genre] ?? s.key
    return s.key
}
export const kindLabel: Record<Kind, string> = { decade: 'Decade', year: 'Year', artist: 'Artist', genre: 'Genre' }

export type Facet = 'Themes' | 'Mood' | 'Style' | 'Voice'
export const FACETS: Facet[] = ['Themes', 'Mood', 'Style', 'Voice']

export type Feature = {
    facet: Facet
    label: string
    color: string
    get: (a: Analysis) => number
    /** How to say "subject has more of this": a noun for shares ("Heartbreak"), else a phrase pair. */
    more?: [string, string]
}

const STYLE_LABELS: Record<(typeof STYLES)[number], string> = {
    hookCentric: 'Hooks', conversational: 'Conversational', imagery: 'Imagery', slang: 'Slang', complexity: 'Complexity',
    humor: 'Humor', aggression: 'Aggression', vulnerability: 'Vulnerability',
}
const ADDRESSEE_LABELS: Record<(typeof ADDRESSEES)[number], string> = {
    lover: 'To a lover', ex: 'To an ex', crush: 'To a crush', crowd: 'To the crowd', listener: 'To the listener', self: 'To oneself',
    friend: 'To a friend', family: 'To family', god: 'To God', rival: 'To a rival', society: 'To society', unspecified: 'To no one in particular',
}
const NARRATOR_LABELS: Record<(typeof NARRATORS)[number], string> = { first: 'Sung as “I”', second: 'Sung as “you”', third: 'Told about others', mixed: 'Mixed voices' }

const styleHue = (i: number) => `oklch(0.78 0.12 ${Math.round(180 + i * 22)})`

export const FEATURES: Feature[] = [
    ...THEME_GROUPS.flatMap((g) => g.themes).map((t): Feature => ({ facet: 'Themes', label: THEME_LABELS[t], color: THEME_COLORS[t], get: (a) => a.weights[t] })),
    ...EMOTIONS.map((e): Feature => ({
        facet: 'Mood', label: EMOTION_LABELS[e], color: EMOTION_COLORS[e],
        get: (a) => (a.emotion === e ? 1 : a.secondaryEmotion === e ? 0.4 : 0),
    })),
    ...STYLES.map((s, i): Feature => ({ facet: 'Style', label: STYLE_LABELS[s], color: styleHue(i), get: (a) => a.style[s] })),
    ...NARRATORS.filter((n) => n !== 'mixed').map((n): Feature => ({ facet: 'Voice', label: NARRATOR_LABELS[n], color: 'oklch(0.8 0.1 260)', get: (a) => (a.narrator === n ? 1 : 0) })),
    ...ADDRESSEES.filter((x) => x !== 'unspecified').map((x): Feature => ({ facet: 'Voice', label: ADDRESSEE_LABELS[x], color: 'oklch(0.78 0.11 300)', get: (a) => (a.addressee === x ? 1 : 0) })),
    { facet: 'Voice', label: 'Storytelling', color: 'oklch(0.8 0.1 160)', get: (a) => a.storytelling, more: ['more storytelling', 'less storytelling'] },
    // Diff-only features (not drawn on a radar): the overall mood.
    { facet: 'Mood', label: 'Brightness', color: INK.text, get: (a) => (a.valence + 1) / 2, more: ['a brighter mood', 'a darker mood'] },
    { facet: 'Mood', label: 'Energy', color: INK.text, get: (a) => a.energy, more: ['more energy', 'calmer energy'] },
]
/** Features drawn as radar spokes per facet (the mood summary pair is only used for differences). */
export const RADAR: Record<Facet, number[]> = Object.fromEntries(
    FACETS.map((f) => [f, FEATURES.flatMap((x, i) => (x.facet === f && !x.more ? [i] : f === 'Voice' && x.label === 'Storytelling' ? [i] : []))]),
) as Record<Facet, number[]>

export type Model = {
    songs: Song[] // analyzed only
    vectors: Map<Song, Float32Array>
    mean: Float32Array
    sd: Float32Array
}

export function buildModel(data: Data): Model {
    const songs = data.songs.filter((s) => s.analysis)
    const n = FEATURES.length
    const vectors = new Map<Song, Float32Array>()
    const mean = new Float32Array(n)
    const sq = new Float32Array(n)
    for (const s of songs) {
        const v = new Float32Array(n)
        for (let i = 0; i < n; i++) v[i] = FEATURES[i].get(s.analysis!)
        vectors.set(s, v)
        for (let i = 0; i < n; i++) (mean[i] += v[i]), (sq[i] += v[i] * v[i])
    }
    const sd = new Float32Array(n)
    for (let i = 0; i < n; i++) {
        mean[i] /= songs.length
        sd[i] = Math.sqrt(Math.max(1e-6, sq[i] / songs.length - mean[i] * mean[i]))
    }
    return { songs, vectors, mean, sd }
}

export function songsOf(model: Model, s: Subject): Song[] {
    switch (s.kind) {
        case 'decade': {
            const d = Number(s.key)
            return model.songs.filter((x) => x.charts.some((c) => decadeOf(c.year) === d))
        }
        case 'year': {
            const y = Number(s.key)
            return model.songs.filter((x) => x.charts.some((c) => c.year === y))
        }
        case 'genre':
            return model.songs.filter((x) => x.genre === s.key)
        case 'artist': {
            const k = s.key.toLowerCase()
            return model.songs.filter((x) => x.primaryArtists.some((a) => a.name.toLowerCase() === k))
        }
    }
}

export type Profile = { subject: Subject; songs: Song[]; mean: Float32Array; centroid: [number, number] | null }

export function profile(model: Model, subject: Subject): Profile {
    const songs = songsOf(model, subject)
    const mean = new Float32Array(FEATURES.length)
    for (const s of songs) {
        const v = model.vectors.get(s)!
        for (let i = 0; i < v.length; i++) mean[i] += v[i]
    }
    for (let i = 0; i < mean.length; i++) mean[i] /= songs.length || 1
    const pts = songs.flatMap((s) => (s.galaxy ? [s.galaxy] : []))
    const centroid: [number, number] | null = pts.length ? [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length] : null
    return { subject, songs, mean, centroid }
}

export type Trait = { feature: number; z: number; text: string; strength: number }

/** What sets profile i apart from the others: the features it has most more of, in plain words. */
export function traits(model: Model, profiles: Profile[], i: number, count = 5): Trait[] {
    const others = profiles.filter((_, j) => j !== i)
    if (!others.length) return []
    const out: Trait[] = []
    for (let f = 0; f < FEATURES.length; f++) {
        const mine = profiles[i].mean[f]
        const theirs = others.reduce((a, p) => a + p.mean[f], 0) / others.length
        const z = (mine - theirs) / model.sd[f]
        const feat = FEATURES[f]
        if (feat.more) {
            if (Math.abs(z) < 0.15) continue
            out.push({ feature: f, z: Math.abs(z), strength: Math.abs(z), text: z > 0 ? feat.more[0] : feat.more[1] })
            continue
        }
        if (z <= 0 || mine < 0.02) continue
        const ratio = mine / Math.max(theirs, 1e-3)
        const text = theirs < 0.01 ? `${feat.label}, almost absent from the rest` : ratio >= 1.15 ? `${fmtRatio(ratio)} more ${feat.label.toLowerCase()}` : `a little more ${feat.label.toLowerCase()}`
        out.push({ feature: f, z, strength: z, text: feat.facet === 'Voice' ? `${fmtRatio(ratio)} more often ${feat.label.charAt(0).toLowerCase()}${feat.label.slice(1)}` : text })
    }
    out.sort((a, b) => b.z - a.z)
    // Keep at most two per facet so one dimension doesn't crowd out the rest.
    const per: Record<string, number> = {}
    return out.filter((t) => (per[FEATURES[t.feature].facet] = (per[FEATURES[t.feature].facet] ?? 0) + 1) <= 2).slice(0, count)
}
const fmtRatio = (r: number) => (r >= 10 ? `${Math.round(r)}×` : `${r.toFixed(1).replace(/\.0$/, '')}×`)

/** The songs that best embody what makes profile i distinct, favoring bigger hits a little. */
export function characteristic(model: Model, profiles: Profile[], i: number, count = 5): Song[] {
    const others = profiles.filter((_, j) => j !== i)
    const dir = new Float32Array(FEATURES.length)
    for (let f = 0; f < dir.length; f++) {
        const ref = others.length ? others.reduce((a, p) => a + p.mean[f], 0) / others.length : model.mean[f]
        dir[f] = (profiles[i].mean[f] - ref) / model.sd[f]
    }
    const scored = profiles[i].songs.map((s) => {
        const v = model.vectors.get(s)!
        let score = 0
        for (let f = 0; f < v.length; f++) score += (dir[f] * (v[f] - model.mean[f])) / model.sd[f]
        return { s, score: score + (100 - s.bestRank) * 0.02 }
    })
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, count).map((x) => x.s)
}

/** Every pickable subject, for the searchable picker. Artists need a few analyzed songs to say anything. */
export function catalog(model: Model, data: Data) {
    const years = data.years.map((y) => y.year)
    const decades = [...new Set(years.map(decadeOf))]
    const counts = new Map<string, number>()
    for (const s of model.songs) for (const a of s.primaryArtists) counts.set(a.name, (counts.get(a.name) ?? 0) + 1)
    const artists = [...counts].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).map(([n]) => n)
    const genres = [...new Set(model.songs.map((s) => s.genre).filter(Boolean))] as string[]
    return { decades, years, artists, genres }
}

