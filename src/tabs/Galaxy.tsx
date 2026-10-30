// The Galaxy tab: every song as a star. Songs about similar things cluster; time rises from the 1950s at the
// bottom of the disk to today at the top. Hover (or tap) a star to read it, and search to fly to a song.
import { Button, Card, CardContent, Input, ToggleGroup, ToggleGroupItem } from '@kevinschaich/components'
import { Search, X } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import type { Data, Song } from '../data'
import { decadeLabel } from '../data'
import { DECADE_COLORS, EMOTION_COLORS, EMOTION_LABELS, GENRE_COLORS, GENRE_LABELS, INK, THEME_COLORS, THEME_LABELS, THEMES, TYPE } from '../theme'
import { oklchToRgb } from './galaxy/color'
import { place } from './galaxy/layout'
import { Loader } from '../status'

const Scene = lazy(() => import('./galaxy/Scene'))

type Mode = 'theme' | 'decade' | 'emotion' | 'genre'
const MODES: { id: Mode; label: string }[] = [
    { id: 'theme', label: 'Theme' },
    { id: 'decade', label: 'Decade' },
    { id: 'emotion', label: 'Mood' },
    { id: 'genre', label: 'Genre' },
]

function colorOf(s: Song, mode: Mode): string {
    if (mode === 'decade') return DECADE_COLORS[Math.min(s.decade, 2020)] ?? INK.muted
    if (mode === 'emotion') return s.analysis ? EMOTION_COLORS[s.analysis.emotion] : INK.muted
    if (mode === 'genre') return s.genre ? GENRE_COLORS[s.genre] : INK.muted
    return s.analysis?.primaryTheme ? THEME_COLORS[s.analysis.primaryTheme] : INK.muted
}

function legendOf(songs: Song[], mode: Mode): { label: string; color: string }[] {
    if (mode === 'theme') return []
    const counts = new Map<string, number>()
    for (const s of songs) {
        const k = mode === 'decade' ? String(s.decade) : mode === 'emotion' ? s.analysis?.emotion : s.genre
        if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    const keys = [...counts.keys()]
    if (mode === 'decade') return keys.sort().map((d) => ({ label: decadeLabel(+d), color: DECADE_COLORS[+d] }))
    return keys
        .sort((a, b) => counts.get(b)! - counts.get(a)!)
        .slice(0, 8)
        .map((k) =>
            mode === 'emotion'
                ? { label: EMOTION_LABELS[k as keyof typeof EMOTION_LABELS], color: EMOTION_COLORS[k as keyof typeof EMOTION_COLORS] }
                : { label: GENRE_LABELS[k as keyof typeof GENRE_LABELS], color: GENRE_COLORS[k as keyof typeof GENRE_COLORS] },
        )
}

export function Galaxy({ data }: { data: Data }) {
    const songs = useMemo(() => data.songs.filter((s) => s.galaxy), [data])
    const [mode, setMode] = useState<Mode>('theme')
    const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null)
    const [selected, setSelected] = useState<number | null>(null)
    const [focus, setFocus] = useState<{ index: number; nonce: number } | null>(null)
    const [query, setQuery] = useState('')

    const colors = useMemo(() => {
        const out = new Float32Array(songs.length * 3)
        const cache = new Map<string, [number, number, number]>()
        songs.forEach((s, i) => {
            const c = colorOf(s, mode)
            if (!cache.has(c)) cache.set(c, oklchToRgb(c))
            out.set(cache.get(c)!, i * 3)
        })
        return out
    }, [songs, mode])

    const neighbors = useMemo(() => {
        if (selected == null) return []
        const [x, y] = songs[selected].galaxy!
        return songs
            .map((s, i) => ({ i, d: (s.galaxy![0] - x) ** 2 + (s.galaxy![1] - y) ** 2 }))
            .filter((n) => n.i !== selected)
            .sort((a, b) => a.d - b.d)
            .slice(0, 8)
            .map((n) => n.i)
    }, [songs, selected])

    const q = query.trim().toLowerCase()
    const matches = useMemo(() => {
        if (q.length < 2) return []
        const out: number[] = []
        songs.forEach((s, i) => {
            if (s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)) out.push(i)
        })
        return out.sort((a, b) => songs[a].bestRank - songs[b].bestRank)
    }, [songs, q])

    const highlight = useMemo(() => {
        const lit = selected != null ? [selected, ...neighbors] : matches
        const active = selected != null || q.length >= 2
        const h = new Float32Array(songs.length).fill(active ? 0 : 1)
        for (const i of lit) h[i] = 2
        return h
    }, [songs, selected, neighbors, matches, q])

    // One floating label per theme, at the middle of where its songs sit (median, so outliers don't drag it).
    const labels = useMemo(() => {
        const by = new Map<string, Song[]>()
        for (const s of songs) {
            const t = s.analysis?.primaryTheme
            if (t) by.set(t, [...(by.get(t) ?? []), s])
        }
        const med = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1]
        // Biggest themes first; skip a label that would sit on top of one already placed.
        const placed: { text: string; pos: [number, number, number]; color: string }[] = []
        for (const t of [...THEMES].sort((a, b) => (by.get(b)?.length ?? 0) - (by.get(a)?.length ?? 0))) {
            const g = by.get(t)
            if (!g || g.length < 25 || placed.length >= (window.innerWidth < 640 ? 10 : 30)) continue
            const p = place([med(g.map((s) => s.galaxy![0])), med(g.map((s) => s.galaxy![1]))], med(g.map((s) => s.year)))
            if (placed.some((l) => Math.hypot(l.pos[0] - p[0], l.pos[2] - p[2]) < (window.innerWidth < 640 ? 10 : 7))) continue
            placed.push({ text: THEME_LABELS[t], pos: [p[0], p[1] + 2.5, p[2]], color: THEME_COLORS[t] })
        }
        return placed
    }, [songs])

    const select = (i: number | null) => {
        setSelected(i)
        setHover(null)
        if (i != null) setFocus({ index: i, nonce: Date.now() })
    }
    const hovered = hover ? songs[hover.i] : null
    const sel = selected != null ? songs[selected] : null
    const legend = legendOf(songs, mode)

    return (
        <div className="relative h-full w-full overflow-hidden" style={{ background: INK.bg }}>
            <Suspense fallback={<Loader />}>
                <Scene
                    songs={songs}
                    colors={colors}
                    highlight={highlight}
                    labels={mode === 'theme' ? labels : []}
                    focus={focus}
                    selected={selected}
                    neighbors={neighbors}
                    onHover={(i, x, y) => setHover(i == null ? null : { i, x, y })}
                    onSelect={select}
                />
            </Suspense>

            {/* Top bar: search and color mode. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between sm:p-4">
                <div className="pointer-events-auto relative w-full sm:w-72">
                    <Search className="pointer-events-none absolute z-10 left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Find a song or artist"
                        className="bg-background/70 pl-8 backdrop-blur"
                        aria-label="Find a song or artist"
                    />
                    {matches.length > 0 && selected == null && (
                        <Card className="absolute inset-x-0 top-full z-30 mt-1 gap-0 overflow-hidden bg-background/90 py-1 backdrop-blur">
                            {matches.slice(0, 6).map((i) => (
                                <button
                                    key={songs[i].id}
                                    className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                                    onClick={() => select(i)}
                                >
                                    <span className="truncate">{songs[i].title}</span>
                                    <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground">{songs[i].artist} · {songs[i].year}</span>
                                </button>
                            ))}
                        </Card>
                    )}
                </div>
                <ToggleGroup
                    value={[mode]}
                    onValueChange={(v: string[]) => v[0] && setMode(v[0] as Mode)}
                    variant="outline"
                    size="sm"
                    className="pointer-events-auto bg-background/70 backdrop-blur"
                >
                    {MODES.map((m) => (
                        <ToggleGroupItem key={m.id} value={m.id}>
                            {m.label}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
            </div>

            {/* Legend for the non-theme modes (theme mode labels clusters in the scene). */}
            {!sel && (
                <div className="pointer-events-none absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md">
                    {legend.length > 0 ? (
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {legend.map((l) => (
                                <span key={l.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <span className="size-2 rounded-full" style={{ background: l.color, boxShadow: `0 0 6px ${l.color}` }} />
                                    {l.label}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className={TYPE.annotation}>
                            Songs about similar things gather together. The oldest sit at the bottom of the disk, the newest at the top.
                        </p>
                    )}
                </div>
            )}

            {/* Hover card (mouse only; on phones a tap selects). */}
            {hovered && !sel && (
                <Card
                    className="pointer-events-none absolute z-20 w-64 gap-1 bg-background/90 px-3 py-2.5 backdrop-blur"
                    style={{ left: Math.min(hover!.x + 14, window.innerWidth - 272), top: hover!.y + 14 }}
                >
                    <SongText song={hovered} />
                </Card>
            )}

            {/* Selected song and its nearest neighbors. */}
            {sel && (
                <Card className="absolute inset-x-3 bottom-3 z-20 max-h-[42%] gap-2 overflow-y-auto bg-background/90 py-3 backdrop-blur sm:bottom-4 sm:left-auto sm:right-4 sm:w-80">
                    <CardContent className="flex flex-col gap-2 px-3">
                        <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                                <SongText song={sel} />
                            </div>
                            <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={() => select(null)}>
                                <X />
                            </Button>
                        </div>
                        {neighbors.length > 0 && (
                            <div className="flex flex-col gap-0.5 border-t pt-2">
                                <p className={TYPE.label}>Nearby in the galaxy</p>
                                {neighbors.map((i) => (
                                    <button key={songs[i].id} className="flex items-baseline gap-2 rounded px-1 py-1 text-left text-sm hover:bg-accent" onClick={() => select(i)}>
                                        <span className="size-1.5 shrink-0 self-center rounded-full" style={{ background: colorOf(songs[i], mode) }} />
                                        <span className="truncate">{songs[i].title}</span>
                                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{songs[i].year}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

function SongText({ song }: { song: Song }) {
    const t = song.analysis?.primaryTheme
    return (
        <>
            <p className="font-heading text-sm font-semibold leading-snug">{song.title}</p>
            <p className="text-xs text-muted-foreground">
                {song.artist} · {song.year}
                {t && (
                    <>
                        {' · '}
                        <span style={{ color: THEME_COLORS[t] }}>{THEME_LABELS[t]}</span>
                    </>
                )}
            </p>
            {song.analysis?.summary && <p className="mt-1 text-xs leading-relaxed text-foreground/85">{song.analysis.summary}</p>}
        </>
    )
}
