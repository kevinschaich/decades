// The shared visual language every tab uses: colors for themes, emotions and genres, decade colors and the type
// scale. Colors are tuned to glow on the near-black background (oklch, similar lightness so no theme shouts by
// accident). Fonts come only from the --font-* variables (shared rules), never named here.
import { EMOTIONS, GENRES, THEMES, type Emotion, type Genre, type Theme } from './schema'

/** The background every visualization draws on, and the ink for text, axes and gridlines over it. */
export const INK = {
    bg: 'oklch(0.13 0.005 285)', // matches the dark zinc background
    surface: 'oklch(0.18 0.006 285)',
    grid: 'oklch(1 0 0 / 0.07)',
    axis: 'oklch(1 0 0 / 0.35)',
    muted: 'oklch(0.705 0.015 286)',
    text: 'oklch(0.985 0 0)',
} as const

/** Theme groups: each family shares a hue range, so related themes read together in rivers and galaxies. */
export const THEME_GROUPS: { name: string; themes: Theme[] }[] = [
    { name: 'Love', themes: ['love_romance', 'heartbreak', 'desire_sex', 'longing', 'loneliness'] },
    { name: 'Party', themes: ['partying', 'dancing', 'celebration_joy', 'drugs_alcohol'] },
    { name: 'Status', themes: ['money_wealth', 'fame_status', 'bragging', 'empowerment', 'work_struggle'] },
    { name: 'Rebellion', themes: ['rebellion', 'freedom_escape', 'violence_crime', 'war_conflict', 'social_politics'] },
    { name: 'Roots', themes: ['nostalgia', 'family', 'friendship', 'hometown_place', 'youth_school', 'faith_spirituality'] },
    { name: 'World', themes: ['cars_travel', 'nature_seasons', 'technology_media', 'self_reflection', 'mental_health'] },
]

const GROUP_HUES: Record<string, [number, number]> = {
    Love: [350, 380], // rose to coral, past 360 so it takes the short way round
    Party: [300, 330], // magenta to pink
    Status: [70, 95], // gold to amber
    Rebellion: [25, 45], // red-orange
    Roots: [140, 175], // green to teal
    World: [200, 270], // cyan to violet
}

export const THEME_COLORS = Object.fromEntries(
    THEME_GROUPS.flatMap((g) => {
        const [h0, h1] = GROUP_HUES[g.name]
        return g.themes.map((t, i) => {
            const k = g.themes.length > 1 ? i / (g.themes.length - 1) : 0
            const l = 0.78 - k * 0.14
            return [t, `oklch(${l.toFixed(3)} 0.16 ${((h0 + (h1 - h0) * k) % 360).toFixed(0)})`]
        })
    }),
) as Record<Theme, string>

export const THEME_LABELS: Record<Theme, string> = {
    love_romance: 'Love', heartbreak: 'Heartbreak', desire_sex: 'Desire', longing: 'Longing', partying: 'Partying',
    dancing: 'Dancing', money_wealth: 'Money', fame_status: 'Fame', bragging: 'Bragging', rebellion: 'Rebellion',
    freedom_escape: 'Freedom', nostalgia: 'Nostalgia', loneliness: 'Loneliness', empowerment: 'Empowerment',
    friendship: 'Friendship', family: 'Family', faith_spirituality: 'Faith', social_politics: 'Society',
    violence_crime: 'Violence', drugs_alcohol: 'Drugs & drink', cars_travel: 'Cars & travel', hometown_place: 'Hometown',
    nature_seasons: 'Nature', youth_school: 'Youth', technology_media: 'Technology', self_reflection: 'Self-reflection',
    mental_health: 'Mental health', celebration_joy: 'Celebration', war_conflict: 'War', work_struggle: 'Work & struggle',
}

export const EMOTION_COLORS: Record<Emotion, string> = {
    joy: 'oklch(0.86 0.17 95)', love: 'oklch(0.72 0.19 5)', desire: 'oklch(0.65 0.22 350)', longing: 'oklch(0.7 0.12 280)',
    sadness: 'oklch(0.62 0.13 250)', anger: 'oklch(0.63 0.22 28)', defiance: 'oklch(0.7 0.19 45)',
    confidence: 'oklch(0.8 0.16 75)', fear: 'oklch(0.55 0.1 300)', nostalgia: 'oklch(0.76 0.09 60)',
    hope: 'oklch(0.82 0.14 150)', calm: 'oklch(0.8 0.09 200)', playfulness: 'oklch(0.8 0.16 330)',
    bitterness: 'oklch(0.6 0.12 120)', awe: 'oklch(0.85 0.1 230)',
}
export const EMOTION_LABELS = Object.fromEntries(EMOTIONS.map((e) => [e, e[0].toUpperCase() + e.slice(1)])) as Record<Emotion, string>

export const GENRE_COLORS: Record<Genre, string> = Object.fromEntries(
    GENRES.map((g, i) => [g, `oklch(0.74 0.14 ${Math.round((i * 360) / GENRES.length + 15)})`]),
) as Record<Genre, string>
export const GENRE_LABELS: Record<Genre, string> = {
    rock: 'Rock', 'alternative/indie': 'Alternative', 'electronic/dance': 'Dance', soul: 'Soul',
    'classical/soundtrack': 'Soundtrack', pop: 'Pop', 'hip-hop/rnb': 'Hip-hop & R&B', disco: 'Disco', swing: 'Swing',
    folk: 'Folk', country: 'Country', jazz: 'Jazz', religious: 'Gospel', blues: 'Blues', reggae: 'Reggae',
}

/** One color per decade, a cool-to-warm sweep from the 1950s to the 2020s. */
export const DECADES = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020] as const
export const DECADE_COLORS: Record<number, string> = Object.fromEntries(
    DECADES.map((d, i) => [d, `oklch(0.75 0.15 ${Math.round(250 - i * 32)})`]),
)

/** Valence (-1..1) to a diverging blue → near-white → amber color. */
export function valenceColor(v: number): string {
    const k = Math.max(-1, Math.min(1, v))
    return k < 0
        ? `oklch(${(0.85 + k * 0.25).toFixed(3)} ${(-k * 0.15).toFixed(3)} 250)`
        : `oklch(${(0.85 - k * 0.05).toFixed(3)} ${(k * 0.16).toFixed(3)} 75)`
}

/** Tailwind classes for the type scale, so headings and annotations match across tabs. */
export const TYPE = {
    display: 'font-heading text-4xl sm:text-6xl font-semibold tracking-tight leading-none',
    title: 'font-heading text-2xl sm:text-3xl font-semibold tracking-tight',
    heading: 'font-heading text-lg font-semibold tracking-tight',
    body: 'text-sm sm:text-base text-foreground/90 leading-relaxed',
    label: 'text-[11px] uppercase tracking-[0.14em] text-muted-foreground',
    number: 'font-mono tabular-nums',
    annotation: 'text-xs text-muted-foreground italic',
} as const

export { EMOTIONS, GENRES, THEMES }
