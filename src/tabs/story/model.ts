// The Story tab's chapters, computed from the data so every caption stays true as the data changes.
import { averageYears, decadeLabel, EMOTIONS, THEMES, type Data, type Emotion, type Song, type Theme, type Year } from '../../data'
import { EMOTION_LABELS, THEME_LABELS } from '../../theme'

export type Layout = 'galaxy' | 'timeline' | 'themesByYear' | 'hiphop' | 'explicit' | 'voice' | 'clusters' | 'mood' | 'finale'

export type Spark = { points: [number, number][]; mark?: number; label: string }

export type Step = {
    id: string
    layout: Layout
    decade?: number // highlighted decade
    kicker: string
    title: string
    body: string
    song?: Song
    spark?: Spark
}

const pct = (v: number) => `${Math.round(v * 100)}%`
/** A share in words: 0.5 → "half", 0.33 → "a third", else a percent. */
function share(v: number): string {
    const words: [number, string][] = [[1 / 4, 'a quarter'], [1 / 3, 'a third'], [1 / 2, 'half'], [2 / 3, 'two thirds'], [3 / 4, 'three quarters']]
    for (const [f, w] of words) if (Math.abs(v - f) < 0.02) return w
    if (v < 0.1) return `1 in ${Math.round(1 / v)}`
    return pct(v)
}
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
const lower = (s: string) => (s === 'Self-reflection' ? 'self-reflection' : s.toLowerCase())
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
const weighted = (ys: Year[], f: (y: Year) => number) => {
    let s = 0, w = 0
    for (const y of ys) (s += f(y) * y.analyzed), (w += y.analyzed)
    return s / (w || 1)
}
/** A centered 3-year rolling mean, so one odd year doesn't make a turning point. */
function rolled(ys: Year[], f: (y: Year) => number): [number, number][] {
    return ys.map((y, i) => [y.year, mean(ys.slice(Math.max(0, i - 1), i + 2).map(f))])
}

export function buildStory(data: Data): Step[] {
    const years = data.years.filter((y) => y.analyzed > 0)
    const decades = [...new Set(years.map((y) => y.decade))].sort((a, b) => a - b)
    const ofDecade = (d: number) => years.filter((y) => y.decade === d)
    const lastDecade = decades.at(-1)!
    const label = (d: number) => (d === lastDecade && data.years.at(-1)!.decade === d ? `${d}s so far` : `${d}s`)

    const allThemes = averageYears(years, (y) => y.themes)
    const allEmotions = averageYears(years, (y) => y.emotions)
    const dec = decades.map((d) => {
        const ys = ofDecade(d)
        return {
            d, ys,
            themes: averageYears(ys, (y) => y.themes),
            emotions: averageYears(ys, (y) => y.emotions),
            valence: weighted(ys, (y) => y.valence),
            energy: weighted(ys, (y) => y.energy),
            explicit: weighted(ys, (y) => y.explicitShare),
            words: weighted(ys, (y) => y.metrics.wordCount),
            hiphop: mean(ys.map((y) => y.genres['hip-hop/rnb'])),
        }
    })
    const byValence = [...dec].sort((a, b) => b.valence - a.valence)
    const byEnergy = [...dec].sort((a, b) => b.energy - a.energy)
    const topTheme = (r: Record<Theme, number>) => THEMES.reduce((a, b) => (r[b] > r[a] ? b : a))
    const loveAlways = dec.every((x) => topTheme(x.themes) === 'love_romance')

    const steps: Step[] = []
    const first = decades[0], last = data.lastYear
    steps.push({
        id: 'intro', layout: 'galaxy', kicker: `${first}–${last}`, title: 'The story of us, told through the songs we loved most',
        body: 'Every point of light is a song that finished a year near the top of the Billboard Hot 100. Songs that sing about similar things sit close together. Scroll to travel through the decades.',
    })
    steps.push({
        id: 'timeline', layout: 'timeline', kicker: 'Every year, every hit', title: 'Lined up in time',
        body: `Now each column is a year, from ${first} to ${last}, with the year's biggest hit at the top. ${loveAlways ? 'One thing never changes: in every decade, love is what we sing about most. What changes is everything around it.' : 'Watch what rises and falls around it.'}`,
    })

    for (const x of dec) {
        // What this decade sang about more than any other time, and the mood it carried.
        const rising = THEMES.filter((t) => t !== 'love_romance')
            .map((t) => ({ t, lift: x.themes[t] - allThemes[t], ratio: x.themes[t] / (allThemes[t] || 1) }))
            .filter((r) => r.lift > 0)
            .sort((a, b) => b.lift - a.lift).slice(0, 2)
        const fading = THEMES.map((t) => ({ t, lift: x.themes[t] - allThemes[t] })).sort((a, b) => a.lift - b.lift)[0]
        const emo = EMOTIONS.map((e) => ({ e, lift: x.emotions[e] - allEmotions[e] })).sort((a, b) => b.lift - a.lift)[0].e as Emotion
        const vRank = byValence.indexOf(x), eRank = byEnergy.indexOf(x)
        const mood =
            vRank === 0 ? 'the sunniest decade on the charts'
            : vRank === dec.length - 1 ? 'the gloomiest decade on the charts'
            : eRank === 0 ? 'the most energetic decade on the charts'
            : eRank === dec.length - 1 ? 'the most mellow decade on the charts'
            : vRank < dec.length / 2 ? 'brighter than most' : 'moodier than most'
        const themeWords = list(rising.map((r) => lower(THEME_LABELS[r.t])))
        let body = `More than any other era, the ${label(x.d)} sang about ${themeWords}, and less about ${lower(THEME_LABELS[fading.t])}. The mood: ${mood}, with ${lower(EMOTION_LABELS[emo])} running stronger than usual.`
        if (x.explicit >= 0.05) body += ` About ${share(x.explicit)} of its hits were explicit.`

        // A standout: a year's #1 that sings about what made the decade distinct, else the decade's first #1.
        const ones = data.songs.filter((s) => s.analysis?.summary && s.charts.some((c) => c.rank === 1 && Math.floor(c.year / 10) * 10 === x.d))
        const song = ones.find((s) => rising.some((r) => r.t === s.analysis!.primaryTheme)) ?? ones[0]
        steps.push({ id: `d${x.d}`, layout: 'themesByYear', decade: x.d, kicker: label(x.d), title: titleFor(x.d, rising.map((r) => r.t)), body, song })

        if (x.d === 1980) steps.push(hiphopStep(years))
        if (x.d === 1990) steps.push(explicitStep(years))
        if (x.d === 2000) steps.push(voiceStep(years, dec))
    }

    // Regroup by theme: what grew and what faded from the first decade to the latest.
    const a = dec[0], z = dec.at(-1)!
    const change = THEMES.map((t) => ({ t, d: z.themes[t] - a.themes[t] })).sort((p, q) => q.d - p.d)
    steps.push({
        id: 'clusters', layout: 'clusters', kicker: 'Then and now', title: 'What we sing about, regrouped',
        body: `Gathered by what they're about, the songs form six families. Since the ${decadeLabel(a.d)}, ${list(change.slice(0, 2).map((c) => lower(THEME_LABELS[c.t])))} grew the most, while ${list(change.slice(-2).reverse().map((c) => lower(THEME_LABELS[c.t])))} faded.`,
    })
    const sunny = byValence[0], gloomy = byValence.at(-1)!
    steps.push({
        id: 'mood', layout: 'mood', kicker: 'How it felt', title: 'Happy, sad, calm, wild',
        body: `Spread by mood, happier songs drift right and more energetic ones rise. The ${label(sunny.d)} were the sunniest era; the ${label(gloomy.d)} are the gloomiest, and ${byEnergy[0].d === z.d ? 'yet the most energetic' : `the ${label(byEnergy[0].d)} the most energetic`}.`,
        spark: { points: rolled(years, (y) => y.valence), label: 'How happy the hits sound' },
    })
    steps.push({
        id: 'finale', layout: 'finale', kicker: 'Still playing', title: 'Every era, side by side',
        body: `Back in the galaxy, now colored by decade. ${loveAlways ? 'Every generation finds new words and new sounds, yet love stays at the heart of the charts. ' : ''}Tap any point to read what that song is about, or explore the other tabs.`,
    })
    return steps
}

function titleFor(d: number, rising: Theme[]): string {
    const t = rising[0] ? THEME_LABELS[rising[0]] : 'Love'
    return `The ${d}s: ${t}${rising[1] ? ` and ${lower(THEME_LABELS[rising[1]])}` : ''}`
}

function hiphopStep(years: Year[]): Step {
    const pts = rolled(years, (y) => y.genres['hip-hop/rnb'])
    const half = pts.find(([, v]) => v >= 0.5)
    const peak = pts.reduce((a, b) => (b[1] > a[1] ? b : a))
    return {
        id: 'hiphop', layout: 'hiphop', kicker: 'Turning point', title: 'The rise of hip-hop and R&B',
        body: `Each column now stacks its hip-hop and R&B hits from the bottom. They climb decade after decade${half ? `, and by ${half[0]} they make up half of the year's biggest songs` : ''}. Around ${peak[0]} they reach ${share(peak[1])}.`,
        spark: { points: pts, mark: half?.[0], label: 'Share of hits that are hip-hop or R&B' },
    }
}

function explicitStep(years: Year[]): Step {
    const pts = rolled(years, (y) => y.explicitShare)
    const start = pts.find(([, v]) => v >= 0.1)
    const peak = pts.reduce((a, b) => (b[1] > a[1] ? b : a))
    return {
        id: 'explicit', layout: 'explicit', kicker: 'Turning point', title: 'The charts stop blushing',
        body: `For decades, hits were almost never explicit.${start ? ` Around ${start[0]} that changes fast` : ''}: by ${peak[0]}, about ${share(peak[1])} of the year's hits carry explicit language or themes. The glowing points are the explicit songs.`,
        spark: { points: pts, mark: start?.[0], label: 'Share of hits that are explicit' },
    }
}

function voiceStep(years: Year[], dec: { d: number; words: number }[]): Step {
    const pts = rolled(years, (y) => y.metrics.wordCount)
    const most = dec.reduce((a, b) => (b.words > a.words ? b : a))
    const ratio = most.words / dec[0].words
    const i = rolled(years, (y) => y.metrics.pronounI)
    const iFirst = mean(i.slice(0, 10).map((p) => p[1])), iPeak = i.reduce((a, b) => (b[1] > a[1] ? b : a))
    return {
        id: 'voice', layout: 'voice', kicker: 'Turning point', title: 'More words, more "I"',
        body: `Points now rise with how many words a song has. Hits got far wordier: a ${decadeLabel(most.d)} hit has about ${ratio.toFixed(1).replace(/\.0$/, '')} times as many words as one from the ${decadeLabel(dec[0].d)}. Singers also talk about themselves more, saying "I" about ${(iPeak[1] / iFirst).toFixed(1).replace(/\.0$/, '')} times as often by ${iPeak[0]}.`,
        spark: { points: pts, label: 'Words per hit' },
    }
}
