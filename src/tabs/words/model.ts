// The numbers behind the Words tab: which lyric measures we show, per-song values, per-year spreads, the violin-shaped
// point layout and plain-language findings. Everything here is computed from the data; no copy states a number that
// wasn't measured.
import * as d3 from 'd3'
import { decadeLabel, decadeOf, type Data, type Song } from '../../data'

export type MetricId = 'variety' | 'repetition' | 'length' | 'rhyme' | 'wordLength' | 'profanity' | 'explicit' | 'nonEnglish'

export type MetricDef = {
    id: MetricId
    label: string
    blurb: string
    get: (s: Song) => number | null
    domain: [number, number]
    scale: 'linear' | 'log' | 'sqrt'
    fmt: (v: number) => string
    /** median for continuous measures, mean for ones that are mostly zero */
    stat: 'median' | 'mean'
    /** which way counts as "simpler", if any */
    simpler?: 'up' | 'down'
    /** words for the extremes, used in outlier labels */
    hi: string
    lo: string
    jitter?: number // vertical jitter in value units for discrete measures
    ticks?: [number, string][]
}

const pct = (v: number) => `${Math.round(v * 100)}%`

export const METRIC_DEFS: MetricDef[] = [
    {
        id: 'variety', label: 'Vocabulary', blurb: 'How much of a song is distinct words rather than ones it already used. Longer songs naturally score a little lower.',
        get: (s) => s.metrics?.lexicalDiversity ?? null, domain: [0, 0.8], scale: 'linear', fmt: pct, stat: 'median', simpler: 'down',
        hi: 'Most varied', lo: 'Fewest distinct words',
    },
    {
        id: 'repetition', label: 'Repetition', blurb: 'How much a song’s lyrics shrink when compressed: the more lines and hooks repeat, the higher it reads.',
        get: (s) => s.metrics?.repetition ?? null, domain: [0.4, 1], scale: 'linear', fmt: pct, stat: 'median', simpler: 'up',
        hi: 'Most repetitive', lo: 'Least repetitive',
    },
    {
        id: 'length', label: 'Length', blurb: 'Words sung, start to finish, counting every repeat.',
        get: (s) => s.metrics?.wordCount ?? null, domain: [40, 2500], scale: 'log', fmt: (v) => `${Math.round(v)} words`, stat: 'median',
        hi: 'Wordiest', lo: 'Fewest words', ticks: [[50, '50'], [100, '100'], [250, '250'], [500, '500'], [1000, '1,000'], [2000, '2,000']],
    },
    {
        id: 'rhyme', label: 'Rhyme', blurb: 'Share of line endings that rhyme with a nearby line, from dictionary pronunciations.',
        get: (s) => s.metrics?.rhymeDensity ?? null, domain: [0, 1], scale: 'linear', fmt: pct, stat: 'median',
        hi: 'Most rhymed', lo: 'Least rhymed',
    },
    {
        id: 'wordLength', label: 'Word length', blurb: 'Average letters per word. Short, plain words pull it down.',
        get: (s) => s.metrics?.avgWordLength ?? null, domain: [3, 4.8], scale: 'linear', fmt: (v) => `${v.toFixed(2)} letters`, stat: 'median', simpler: 'down',
        hi: 'Longest words', lo: 'Shortest words',
    },
    {
        id: 'profanity', label: 'Profanity', blurb: 'Swear words per hundred words, from a standard list of profanity.',
        get: (s) => (s.metrics && s.metrics.wordCount > 0 ? (s.metrics.profanityCount / s.metrics.wordCount) * 100 : null),
        domain: [0, 12], scale: 'sqrt', fmt: (v) => `${v.toFixed(1)} per 100 words`, stat: 'mean',
        hi: 'Most profane', lo: 'Cleanest', ticks: [[0, '0'], [1, '1'], [3, '3'], [6, '6'], [12, '12']],
    },
    {
        id: 'explicit', label: 'Explicitness', blurb: 'How explicit a song is about sex, drugs, violence or language, rated from clean to graphic.',
        get: (s) => s.analysis?.explicitness ?? null, domain: [-0.5, 3.5], scale: 'linear', fmt: (v) => ['Clean', 'Mild', 'Explicit', 'Graphic'][Math.round(v)] ?? v.toFixed(1),
        stat: 'mean', hi: 'Most explicit', lo: 'Cleanest', jitter: 0.32,
        ticks: [[0, 'Clean'], [1, 'Mild'], [2, 'Explicit'], [3, 'Graphic']],
    },
    {
        id: 'nonEnglish', label: 'Other languages', blurb: 'Share of a song’s lyrics in a language other than English.',
        get: (s) => (s.analysis ? s.analysis.nonEnglishShare : null), domain: [0, 1], scale: 'sqrt', fmt: pct, stat: 'mean',
        hi: 'Least English', lo: 'All English', jitter: 0.015, ticks: [[0, '0%'], [0.1, '10%'], [0.25, '25%'], [0.5, '50%'], [1, '100%']],
    },
]

export function yScale(def: MetricDef, range: [number, number]) {
    const [a, b] = def.domain
    if (def.scale === 'log') return d3.scaleLog().domain([a, b]).range(range).clamp(true)
    if (def.scale === 'sqrt') return d3.scaleSqrt().domain([a, b]).range(range).clamp(true)
    return d3.scaleLinear().domain([a, b]).range(range).clamp(true)
}

/** Deterministic 0..1 noise from a song id, so the layout doesn't shuffle between renders. */
export function hash01(id: string, salt = 0) {
    let h = 2166136261 ^ salt
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
    return ((h >>> 0) % 100000) / 100000
}

export type Pt = { song: Song; year: number; value: number }

/** Songs that have lyric measures, placed in the year they first charted. */
export function points(data: Data): Song[] {
    return data.songs.filter((s) => s.metrics && s.analysis).sort((a, b) => a.year - b.year)
}

export type YearStat = { year: number; q1: number; med: number; q3: number; mean: number; stat: number }

export function yearStats(songs: Song[], def: MetricDef): YearStat[] {
    // each year pools its neighbours (a 3-year window) so the line shows the trend, not chart-to-chart noise
    const g = d3.group(songs, (s) => s.year)
    const pooled = [...g.keys()].map((year) => [year, [-1, 0, 1].flatMap((k) => g.get(year + k) ?? [])] as const)
    return pooled.sort((a, b) => a[0] - b[0]).flatMap(([year, list]) => {
        const v = list.map(def.get).filter((x): x is number => x != null).sort(d3.ascending)
        if (v.length < 5) return []
        const mean = d3.mean(v)!
        const med = d3.quantileSorted(v, 0.5)!
        return [{ year, q1: d3.quantileSorted(v, 0.25)!, med, q3: d3.quantileSorted(v, 0.75)!, mean, stat: def.stat === 'mean' ? mean : med }]
    })
}

/**
 * Horizontal offsets in -1..1 for every song so each year's column takes the shape of its own distribution
 * (a violin made of points): the offset's reach is the local density at that song's value.
 */
export function violinOffsets(songs: Song[], def: MetricDef, y: (v: number) => number, height: number): Float32Array {
    const out = new Float32Array(songs.length)
    const byYear = d3.group(songs.map((s, i) => [s, i] as const), ([s]) => s.year)
    const bins = 48
    for (const list of byYear.values()) {
        const dens = new Float32Array(bins)
        const pos = list.map(([s]) => {
            const v = def.get(s)
            return v == null ? -1 : Math.max(0, Math.min(0.9999, y(v) / height))
        })
        for (const p of pos) if (p >= 0) {
            const c = p * bins
            for (let b = 0; b < bins; b++) dens[b] += Math.exp(-(((b + 0.5 - c) / 2.2) ** 2))
        }
        const max = Math.max(...dens) || 1
        list.forEach(([s, i], k) => {
            const p = pos[k]
            const reach = p < 0 ? 0 : Math.sqrt(dens[Math.floor(p * bins)] / max)
            out[i] = (hash01(s.id, 7) * 2 - 1) * reach
        })
    }
    return out
}

const firstDecade = 1950

/** Plain-language findings: the first decade against the most recent one. */
export function decadeChange(songs: Song[], def: MetricDef) {
    const at = (d: number) => {
        const v = songs.filter((s) => decadeOf(s.year) === d).map(def.get).filter((x): x is number => x != null)
        return def.stat === 'mean' ? d3.mean(v) ?? 0 : d3.median(v) ?? 0
    }
    const last = decadeOf(songs[songs.length - 1].year)
    const peakDecades = d3.range(firstDecade, last + 1, 10).map((d) => ({ d, v: at(d) }))
    const a = at(firstDecade), b = at(last)
    const peak = d3.greatest(peakDecades, (x) => x.v)!
    const trough = d3.least(peakDecades, (x) => x.v)!
    return { a, b, last, lastLabel: last === 2020 ? 'the 2020s so far' : `the ${decadeLabel(last)}`, peak, trough, decades: peakDecades }
}

export function finding(songs: Song[], def: MetricDef): string {
    const { a, b, lastLabel, peak, trough } = decadeChange(songs, def)
    const span = def.domain[1] - def.domain[0]
    const rel = Math.abs(b - a) / (def.scale === 'log' ? Math.max(a, 1) : span)
    const word = def.stat === 'mean' ? 'The average' : 'The typical song’s'
    const what = def.label.toLowerCase()
    let s: string
    if (rel < 0.03) s = `${word} ${what} has barely moved: ${def.fmt(a)} in the 50s, ${def.fmt(b)} in ${lastLabel}.`
    else s = `${word} ${what} ${b > a ? 'rose' : 'fell'} from ${def.fmt(a)} in the 50s to ${def.fmt(b)} in ${lastLabel}.`
    const ext = b > a ? peak : trough
    if (ext.d !== firstDecade && ext.d !== decadeOf(songs[songs.length - 1].year)) {
        s += ` It ${b > a ? 'peaked' : 'bottomed out'} in the ${decadeLabel(ext.d)} at ${def.fmt(ext.v)}.`
    }
    return s
}

/** The headline answer, assembled from the measures that have a "simpler" direction. */
export function verdict(songs: Song[]): { answer: string; detail: string } {
    const phrases: { simpler: boolean; text: string }[] = []
    for (const def of METRIC_DEFS) {
        if (!def.simpler) continue
        const { a, b } = decadeChange(songs, def)
        const rel = Math.abs(b - a) / (def.domain[1] - def.domain[0])
        if (rel < 0.03) continue
        const up = b > a
        const simpler = def.simpler === 'up' ? up : !up
        const text = def.id === 'variety' ? (up ? 'use a wider vocabulary' : 'use a narrower vocabulary')
            : def.id === 'repetition' ? (up ? 'repeat themselves more' : 'repeat themselves less')
            : (up ? 'reach for longer words' : 'lean on shorter words')
        phrases.push({ simpler, text })
    }
    const len = decadeChange(songs, METRIC_DEFS.find((d) => d.id === 'length')!)
    const n = phrases.filter((p) => p.simpler).length
    const answer = n === phrases.length && n > 0 ? 'Yes.' : n > 0 ? 'In some ways, yes.' : 'Not really.'
    const list = phrases.map((p) => p.text)
    const joined = list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0] ?? ''
    const lenText = len.b > len.a * 1.15 ? ` They also got ${len.b > len.a * 1.8 ? 'far ' : ''}wordier, so there is more to say but less new to say it with.` : ''
    return { answer, detail: `Compared with the 50s, today’s hits ${joined}.${lenText}` }
}

/** Notable extremes to label: highest and lowest songs that charted well (top 40), spread across eras. */
export function outliers(songs: Song[], def: MetricDef, k = 3): { song: Song; high: boolean }[] {
    if (def.jitter) {
        // discrete measures: show the earliest songs at the extreme, a more interesting story than ties
        const v = songs.filter((s) => def.get(s) != null)
        const max = d3.max(v, def.get) ?? 0
        const firsts = v.filter((s) => def.get(s)! >= max - 1e-9 || (def.id === 'nonEnglish' && def.get(s)! >= 0.5))
        return firsts.slice(0, k).map((song) => ({ song, high: true }))
    }
    const v = songs.filter((s) => def.get(s) != null && s.bestRank <= 40)
    const sorted = [...v].sort((a, b) => def.get(b)! - def.get(a)!)
    const pick = (list: Song[]) => {
        const out: Song[] = []
        for (const s of list) {
            if (out.some((o) => Math.abs(o.year - s.year) < 8)) continue
            out.push(s)
            if (out.length >= k) break
        }
        return out
    }
    // for mostly-zero measures the low end is a tie of thousands, so only the high end is notable
    // a song can only stand for one end (ties or a short list could otherwise put it at both)
    const highs = pick(sorted)
    const lows = def.stat === 'mean' ? [] : pick([...sorted].reverse().filter((s) => !highs.includes(s)))
    return [...highs.map((song) => ({ song, high: true })), ...lows.map((song) => ({ song, high: false }))]
}

export const PRONOUNS = [
    { id: 'pronounI', label: 'I', color: 'oklch(0.8 0.16 75)' },
    { id: 'pronounYou', label: 'You', color: 'oklch(0.72 0.19 5)' },
    { id: 'pronounWe', label: 'We', color: 'oklch(0.8 0.13 165)' },
    { id: 'pronounThey', label: 'They', color: 'oklch(0.72 0.12 260)' },
] as const

/** Per year, each pronoun's share of all I/you/we/they words, averaged over songs; 5-year smoothing. */
export function pronounSeries(songs: Song[]) {
    const g = d3.group(songs, (s) => s.year)
    const rows = [...g].sort((a, b) => a[0] - b[0]).map(([year, list]) => {
        const acc = [0, 0, 0, 0]
        let n = 0
        for (const s of list) {
            const m = s.metrics!
            const vals = PRONOUNS.map((p) => m[p.id])
            const t = d3.sum(vals)
            if (t < 5) continue
            vals.forEach((v, i) => (acc[i] += v / t))
            n++
        }
        return { year, shares: acc.map((v) => v / (n || 1)), n }
    }).filter((r) => r.n >= 5)
    return rows.map((r, i) => {
        const win = rows.slice(Math.max(0, i - 2), i + 3)
        return { year: r.year, shares: r.shares.map((_, k) => d3.mean(win, (w) => w.shares[k])!) }
    })
}

export function pronounFinding(series: ReturnType<typeof pronounSeries>): string {
    const avg = (from: number, to: number, k: number) => d3.mean(series.filter((r) => r.year >= from && r.year <= to), (r) => r.shares[k]) ?? 0
    const last = series[series.length - 1].year
    const i0 = avg(1950, 1959, 0), i1 = avg(last - 9, last, 0)
    const y0 = avg(1950, 1959, 1), y1 = avg(last - 9, last, 1)
    const w0 = avg(1950, 1959, 2), w1 = avg(last - 9, last, 2)
    const lead0 = i0 > y0 ? 'I' : 'you', lead1 = i1 > y1 ? 'I' : 'you'
    const parts = [`In the 50s, ${pct(y0)} of these pronouns were “you” and ${pct(i0)} were “I”; over the last decade it is ${pct(y1)} “you” and ${pct(i1)} “I”.`]
    parts.push(lead0 !== lead1 ? `The songs turned from ${lead0 === 'you' ? 'singing to someone to singing about themselves' : 'singing about themselves to singing to someone'}.` : i1 > i0 ? '“I” keeps gaining ground.' : '“You” keeps its hold.')
    if (Math.abs(w1 - w0) > 0.01) parts.push(`“We” ${w1 > w0 ? 'grew' : 'shrank'} from ${pct(w0)} to ${pct(w1)}.`)
    return parts.join(' ')
}
