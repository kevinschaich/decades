// The vocabularies shared by scripts/build-data.ts and the app. Order matters: public/data stores indices into
// these lists, so append new values at the end and never reorder.

export const THEMES = [
    'love_romance', 'heartbreak', 'desire_sex', 'longing', 'partying', 'dancing', 'money_wealth', 'fame_status',
    'bragging', 'rebellion', 'freedom_escape', 'nostalgia', 'loneliness', 'empowerment', 'friendship', 'family',
    'faith_spirituality', 'social_politics', 'violence_crime', 'drugs_alcohol', 'cars_travel', 'hometown_place',
    'nature_seasons', 'youth_school', 'technology_media', 'self_reflection', 'mental_health', 'celebration_joy',
    'war_conflict', 'work_struggle',
] as const
export type Theme = (typeof THEMES)[number]

export const EMOTIONS = [
    'joy', 'love', 'desire', 'longing', 'sadness', 'anger', 'defiance', 'confidence', 'fear', 'nostalgia', 'hope',
    'calm', 'playfulness', 'bitterness', 'awe',
] as const
export type Emotion = (typeof EMOTIONS)[number]

/** The 2015 project's 15 aggregate genres (pipeline/genres.json, written by pipeline/artists.py), in its order. */
export const GENRES = [
    'rock', 'alternative/indie', 'electronic/dance', 'soul', 'classical/soundtrack', 'pop', 'hip-hop/rnb', 'disco',
    'swing', 'folk', 'country', 'jazz', 'religious', 'blues', 'reggae',
] as const
export type Genre = (typeof GENRES)[number]

export const STYLES = [
    'hookCentric', 'conversational', 'imagery', 'slang', 'complexity', 'humor', 'aggression', 'vulnerability',
] as const
export type Style = (typeof STYLES)[number]

export const NARRATORS = ['first', 'second', 'third', 'mixed'] as const
export const ADDRESSEES = [
    'lover', 'ex', 'crush', 'crowd', 'listener', 'self', 'friend', 'family', 'god', 'rival', 'society', 'unspecified',
] as const
export const GENDERS = ['male', 'female', 'unspecified'] as const
export const ARCS = ['rise', 'fall', 'redemption', 'cycle', 'flat'] as const
export const TIMEFRAMES = ['past', 'present', 'future', 'mixed'] as const
export const EXPLICIT_TOPICS = ['profanity', 'sexual', 'drugs', 'violence'] as const

/** Lyric metrics from pipeline/metrics.json, in the order songs.json stores them (`w`). */
export const METRICS = [
    'wordCount', 'uniqueWords', 'lexicalDiversity', 'repetition', 'rhymeDensity', 'avgWordLength', 'profanityCount',
    'lineCount', 'titleRepeats', 'pronounI', 'pronounYou', 'pronounWe', 'pronounThey',
] as const
export type Metric = (typeof METRICS)[number]

// ---- The raw shapes of public/data (short keys keep the payload small; src/data.ts decodes them) ----

/** One unique song. Analysis fields are absent when no usable lyrics were found. */
export type RawSong = {
    i: string // id
    t: string // title
    a: string // artist as charted
    p: number[] // primary artists, indices into RawSongs.artists
    f?: number[] // featured artists, indices into RawSongs.artists
    c: [number, number][] // [year, rank] for every year it charted
    g?: number[] // aggregate genres, indices into GENRES, most-voted first
    // analysis (Claude), present only when lyrics were usable
    s?: string // summary, a paraphrase (never lyric text)
    th?: [number, number][] // [theme index, weight 0..1], strongest first
    m?: [number, number] // [valence -1..1, energy 0..1]
    e?: [number, number | null] // [primary emotion, secondary emotion] indices into EMOTIONS
    v?: [number, number, number] // perspective: [NARRATORS, ADDRESSEES, GENDERS] indices
    n?: [number, number, number] // narrative: [storytelling 0..1, ARCS index, TIMEFRAMES index]
    y?: number[] // style scores 0..1, in STYLES order
    x?: number // explicitness 0..3
    xt?: number[] // explicit topics, indices into EXPLICIT_TOPICS
    l?: string[] // languages (ISO 639-1), omitted when just ["en"]
    ne?: number // non-English share 0..1, omitted when 0
    r?: { pl?: string[]; br?: string[]; te?: string[]; pe?: string[]; er?: string[] } // named references
    es?: number // era signal 0..1
    cf?: number // confidence 0..1
    w?: number[] // lyric metrics in METRICS order
    gx?: [number, number] // galaxy position, each 0..1
}

export type RawArtist = { n: string; c?: string; k?: string; b?: string; g?: number[] } // name, country, kind, begin year, genres

export type RawSongs = { artists: RawArtist[]; songs: RawSong[] }

/** Per-year aggregates over the songs that charted that year (analysis averages over analyzed songs only). */
export type RawYear = {
    year: number
    partial?: boolean // the current year, ranked from the weekly charts so far
    songs: number // chart entries
    analyzed: number // entries with usable lyrics
    themes: number[] // mean weight per theme (THEMES order; absent = 0)
    primaryThemes: number[] // share of analyzed songs whose primary theme is each theme
    emotions: number[] // share of analyzed songs whose primary emotion is each (EMOTIONS order)
    valence: number
    energy: number
    styles: number[] // mean per STYLES
    storytelling: number
    eraSignal: number
    explicitness: number // mean 0..3
    explicitShare: number // share with explicitness >= 2
    narrators: number[] // shares, NARRATORS order
    addressees: number[] // shares, ADDRESSEES order
    genders: number[] // shares, GENDERS order
    arcs: number[] // shares, ARCS order
    genres: number[] // share of entries tagged with each genre (a song can count in several)
    metrics: number[] // mean per METRICS, over songs with lyrics
    nonEnglish: number // mean non-English share
}
