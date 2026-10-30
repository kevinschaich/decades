// Where each song sits (u, v in 0..1 within the plot) and how it's colored, for every Story layout.
import { THEMES, type Data, type Song } from '../../data'
import { DECADE_COLORS, THEME_COLORS, THEME_GROUPS } from '../../theme'
import type { Layout } from './model'

export type Frame = {
    x: Float32Array
    y: Float32Array
    color: Uint16Array // index into PALETTE
    bright: Uint8Array // 1 = lit, 0 = dimmed
    labels: { text: string; u: number; v: number; align?: CanvasTextAlign }[]
}

const EXPLICIT = ['oklch(0.45 0.02 285)', 'oklch(0.7 0.08 45)', 'oklch(0.7 0.2 35)', 'oklch(0.68 0.23 20)']
const HIPHOP = 'oklch(0.78 0.17 300)'
const OTHER = 'oklch(0.55 0.02 285)'
export const PALETTE: string[] = [...THEMES.map((t) => THEME_COLORS[t]), ...Object.values(DECADE_COLORS), ...EXPLICIT, HIPHOP, OTHER]
const themeIdx = (s: Song) => Math.max(0, THEMES.indexOf(s.analysis!.primaryTheme ?? 'love_romance'))
const decadeIdx = (s: Song) => THEMES.length + Math.max(0, Object.keys(DECADE_COLORS).indexOf(String(Math.min(2020, s.decade))))
const explicitIdx = (s: Song) => THEMES.length + Object.keys(DECADE_COLORS).length + s.analysis!.explicitness
const HIPHOP_IDX = PALETTE.length - 2, OTHER_IDX = PALETTE.length - 1

// Theme order by family, so stacked columns form bands of related color.
const FAMILY_ORDER = THEME_GROUPS.flatMap((g) => g.themes)
const familyRank = (s: Song) => FAMILY_ORDER.indexOf(s.analysis!.primaryTheme ?? 'love_romance')

/** Stable per-song noise in 0..1. */
function hash(i: number, k = 0) {
    let h = (i * 374761393 + k * 668265263) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function makeLayouts(data: Data, songs: Song[]) {
    const n = songs.length
    const y0 = data.firstYear, span = data.lastYear - y0 + 1
    const colU = (year: number) => (year - y0 + 0.5) / span
    const decadeTicks = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020].filter((d) => d >= y0 && d <= data.lastYear).map((d) => ({ text: `'${String(d).slice(2)}`, u: colU(d), v: 1.04, align: 'center' as const }))
    const byYear = Map.groupBy(songs.map((s, i) => ({ s, i })), ({ s }) => s.year)
    const maxCol = Math.max(...[...byYear.values()].map((l) => l.length))

    const blank = (): Frame => ({ x: new Float32Array(n), y: new Float32Array(n), color: new Uint16Array(n), bright: new Uint8Array(n).fill(1), labels: [] })

    /** Each year a column, stacked from the bottom in the given order. */
    function stacked(order: (a: Song, b: Song) => number, color: (s: Song) => number, lit: (s: Song) => boolean): Frame {
        const f = blank()
        for (const [year, list] of byYear) {
            list.sort((a, b) => order(a.s, b.s))
            list.forEach(({ s, i }, k) => {
                f.x[i] = colU(year)
                f.y[i] = 1 - (k + 0.5) / maxCol
                f.color[i] = color(s)
                f.bright[i] = lit(s) ? 1 : 0
            })
        }
        f.labels = decadeTicks
        return f
    }

    const out: Record<Layout, (decade?: number) => Frame> = {
        galaxy: () => {
            const f = blank()
            songs.forEach((s, i) => {
                const g = s.galaxy ?? [hash(i), hash(i, 1)]
                f.x[i] = g[0]; f.y[i] = g[1]; f.color[i] = themeIdx(s)
            })
            return f
        },
        finale: () => {
            const f = out.galaxy()
            songs.forEach((s, i) => (f.color[i] = decadeIdx(s)))
            return f
        },
        timeline: () => {
            const f = stacked((a, b) => b.bestRank - a.bestRank, decadeIdx, () => true)
            f.labels = [...decadeTicks, { text: '#1', u: -0.01, v: 1 - (maxCol - 0.5) / maxCol, align: 'right' }]
            return f
        },
        themesByYear: (d) => stacked((a, b) => familyRank(b) - familyRank(a), themeIdx, (s) => d == null || s.decade === d),
        hiphop: () => stacked((a, b) => Number(isHiphop(b)) - Number(isHiphop(a)), (s) => (isHiphop(s) ? HIPHOP_IDX : OTHER_IDX), isHiphop),
        explicit: () => stacked((a, b) => b.analysis!.explicitness - a.analysis!.explicitness, explicitIdx, (s) => s.analysis!.explicitness >= 2),
        voice: () => {
            const f = blank()
            const words = songs.map((s) => Math.max(20, s.metrics?.wordCount ?? 200))
            const lo = Math.log(40), hi = Math.log(1100)
            songs.forEach((s, i) => {
                f.x[i] = colU(s.year) + (hash(i) - 0.5) / span
                f.y[i] = Math.min(1, Math.max(0, 1 - (Math.log(words[i]) - lo) / (hi - lo)))
                f.color[i] = decadeIdx(s)
            })
            f.labels = [...decadeTicks, { text: '↑ more words', u: 0, v: -0.04, align: 'left' }]
            return f
        },
        clusters: () => {
            const f = blank()
            const groups = THEME_GROUPS.map((g) => g.name)
            const centers = groups.map((_, k) => [(k % 3 + 0.5) / 3, (Math.floor(k / 3) + 0.5) / 2])
            const members = groups.map(() => [] as number[])
            songs.forEach((s, i) => {
                const g = THEME_GROUPS.findIndex((x) => x.themes.includes(s.analysis!.primaryTheme ?? 'love_romance'))
                members[Math.max(0, g)].push(i)
                f.color[i] = themeIdx(s)
            })
            const biggest = Math.max(...members.map((m) => m.length))
            members.forEach((list, k) => {
                list.sort((a, b) => familyRank(songs[a]) - familyRank(songs[b]))
                const r = 0.15 * Math.sqrt(list.length / biggest)
                list.forEach((i, j) => {
                    // A sunflower spiral, so each family packs into a disc sized by how many songs it has.
                    const rr = r * Math.sqrt((j + 0.5) / list.length), a = j * 2.39996
                    f.x[i] = centers[k][0] + rr * Math.cos(a) * 1.05
                    f.y[i] = centers[k][1] + rr * Math.sin(a) * 1.55
                })
                f.labels.push({ text: groups[k], u: centers[k][0], v: centers[k][1] - r * 1.55 - 0.04, align: 'center' })
            })
            return f
        },
        mood: () => {
            const f = blank()
            songs.forEach((s, i) => {
                const a = s.analysis!
                f.x[i] = Math.min(1, Math.max(0, (a.valence + 1) / 2 + (hash(i) - 0.5) * 0.1))
                f.y[i] = Math.min(1, Math.max(0, 0.05 + 0.9 * (1 - a.energy) + (hash(i, 1) - 0.5) * 0.1))
                f.color[i] = decadeIdx(s)
            })
            f.labels = [
                { text: '← sadder', u: 0, v: 1.04, align: 'left' }, { text: 'happier →', u: 1, v: 1.04, align: 'right' },
                { text: '↑ more energy', u: 0, v: -0.04, align: 'left' },
            ]
            return f
        },
    }
    return out
}

const isHiphop = (s: Song) => s.genre === 'hip-hop/rnb'
