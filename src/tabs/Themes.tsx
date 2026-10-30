// Themes: a river of what songs are about, year by year. Three views share one set of streams and morph between
// each other: the river (a wiggle-offset streamgraph), ridges (one small row per theme) and moods (the primary
// emotions as a river, with valence and energy traced underneath). Hover a stream to light it up and see its
// signature songs per decade; click to isolate it.
import { Button, Card, ToggleGroup, ToggleGroupItem } from '@kevinschaich/components'
import { X } from 'lucide-react'
import * as d3 from 'd3'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Data, Emotion, Song, Theme } from '../data'
import { DECADES, EMOTIONS, EMOTION_COLORS, EMOTION_LABELS, INK, THEME_COLORS, THEME_GROUPS, THEME_LABELS, TYPE, valenceColor } from '../theme'

type Mode = 'river' | 'ridges' | 'moods'
type Key = string // 't:<theme>' or 'e:<emotion>' (some names, like longing, are both)
type Shape = { y0: number[]; y1: number[]; o: number } // per year, plus opacity

const THEME_ORDER: Theme[] = THEME_GROUPS.flatMap((g) => g.themes)
const DURATION = 900
const TK: Key[] = THEME_ORDER.map((t) => `t:${t}`)
const EK: Key[] = EMOTIONS.map((e) => `e:${e}`)

function useSize(ref: React.RefObject<HTMLDivElement | null>) {
    const [size, setSize] = useState({ w: 0, h: 0 })
    useEffect(() => {
        const el = ref.current
        if (!el) return
        const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
        ro.observe(el)
        return () => ro.disconnect()
    }, [ref])
    return size
}

/** Triangular moving average, so the river flows rather than jitters. */
function smooth(v: number[], r = 2): number[] {
    return v.map((_, i) => {
        let s = 0, n = 0
        for (let j = Math.max(0, i - r); j <= Math.min(v.length - 1, i + r); j++) { const w = r + 1 - Math.abs(i - j); s += v[j] * w; n += w }
        return s / n
    })
}

export function Themes({ data }: { data: Data }) {
    const wrap = useRef<HTMLDivElement>(null)
    const { w, h } = useSize(wrap)
    const [mode, setMode] = useState<Mode>('river')
    const [hover, setHover] = useState<Key | null>(null)
    const [isolated, setIsolated] = useState<Key | null>(null)
    const [cursor, setCursor] = useState<number | null>(null)
    const phone = w > 0 && w < 640

    const years = useMemo(() => data.years.filter((y) => !y.partial || y.analyzed > 20), [data])
    const yrs = useMemo(() => years.map((y) => y.year), [years])

    // Smoothed series, normalized so each year's themes (and emotions) sum to 1.
    const series = useMemo(() => {
        const norm = <K extends string>(keys: readonly K[], pre: string, pick: (y: (typeof years)[number]) => Record<K, number>) => {
            const raw = years.map((y) => { const r = pick(y); const t = keys.reduce((s, k) => s + (r[k] || 0), 0) || 1; return keys.map((k) => (r[k] || 0) / t) })
            return Object.fromEntries(keys.map((k, i) => [pre + k, smooth(raw.map((r) => r[i]))])) as Record<Key, number[]>
        }
        return {
            themes: norm(THEME_ORDER, 't:', (y) => y.themes),
            emotions: norm(EMOTIONS, 'e:', (y) => y.emotions),
            valence: smooth(years.map((y) => y.valence)),
            energy: smooth(years.map((y) => y.energy)),
        }
    }, [years])

    // Signature songs: per key and decade, the songs that lean hardest into it, weighted toward chart success.
    const signature = useMemo(() => {
        const b = new Map<Key, Map<number, { s: Song; score: number }[]>>()
        const push = (k: Key, s: Song, score: number) => {
            let m = b.get(k); if (!m) b.set(k, (m = new Map()))
            let a = m.get(s.decade); if (!a) m.set(s.decade, (a = []))
            a.push({ s, score })
        }
        for (const s of data.songs) {
            const a = s.analysis
            if (!a) continue
            const pop = 1 - s.bestRank / 120
            for (const t of a.themes.slice(0, 3)) push(`t:${t.theme}`, s, t.weight * pop)
            push(`e:${a.emotion}`, s, pop)
        }
        const out = new Map<Key, Map<number, Song[]>>()
        for (const [k, m] of b) out.set(k, new Map([...m].map(([d, a]) => [d, a.sort((x, y) => y.score - x.score).slice(0, 3).map((x) => x.s)])))
        return out
    }, [data])

    const phonePad = phone ? 8 : 20
    const pad = useMemo(() => ({ l: phonePad, r: phonePad, t: 8, b: 28 }), [phonePad])
    const moodStrip = mode === 'moods' ? Math.min(110, h * 0.22) : 0
    const x = useMemo(() => d3.scaleLinear().domain([yrs[0] ?? 1950, yrs[yrs.length - 1] ?? 2025]).range([pad.l, Math.max(pad.l + 1, w - pad.r)]), [w, yrs, pad])
    const chartH = Math.max(40, h - pad.t - pad.b - moodStrip)

    const targets = useMemo(() => {
        const n = yrs.length
        const mid = pad.t + chartH / 2
        const flat = (y: number): Shape => ({ y0: Array(n).fill(y), y1: Array(n).fill(y), o: 0 })
        const res = new Map<Key, Shape>()
        const stream = (keys: readonly Key[], vals: Record<string, number[]>, iso: Key | null) => {
            if (iso && keys.includes(iso)) {
                const v = vals[iso]
                const k = (chartH * 0.92) / 2 / (d3.max(v) || 1)
                for (const key of keys) res.set(key, key === iso ? { y0: v.map((d) => mid - d * k), y1: v.map((d) => mid + d * k), o: 1 } : flat(mid))
                return
            }
            const rows = yrs.map((_, i) => Object.fromEntries(keys.map((key) => [key, vals[key][i]])))
            const st = d3.stack<Record<string, number>>().keys(keys as string[]).offset(d3.stackOffsetWiggle).order(d3.stackOrderInsideOut)(rows)
            const lo = d3.min(st, (s) => d3.min(s, (d) => d[0]))!, hi = d3.max(st, (s) => d3.max(s, (d) => d[1]))!
            const y = d3.scaleLinear().domain([lo, hi]).range([pad.t + chartH * 0.96, pad.t + chartH * 0.04])
            for (const s of st) res.set(s.key as Key, { y0: s.map((d) => y(d[0])), y1: s.map((d) => y(d[1])), o: 1 })
        }
        if (mode === 'river') {
            stream(TK, series.themes, isolated)
            for (const e of EK) res.set(e, flat(mid))
        } else if (mode === 'moods') {
            stream(EK, series.emotions, isolated)
            for (const t of TK) res.set(t, flat(mid))
        } else {
            const rowH = chartH / (TK.length + 2)
            const peak = d3.max(TK, (t) => d3.max(series.themes[t]))! || 1
            TK.forEach((t, i) => {
                const base = pad.t + rowH * (i + 3)
                const v = series.themes[t]
                const on = !isolated || isolated === t
                res.set(t, { y0: v.map(() => base), y1: v.map((d) => base - (d / peak) * rowH * 2.8), o: on ? 1 : 0.25 })
            })
            for (const e of EK) res.set(e, flat(mid))
        }
        return res
    }, [mode, series, isolated, chartH, yrs, pad])

    // Tween from whatever is on screen to the new targets.
    const [shapes, setShapes] = useState<Map<Key, Shape>>(targets)
    const current = useRef(targets)
    useEffect(() => {
        const from = current.current
        let raf = 0
        const t0 = performance.now()
        const tick = (now: number) => {
            const k = d3.easeCubicInOut(Math.min(1, (now - t0) / DURATION))
            const next = new Map<Key, Shape>()
            for (const [key, to] of targets) {
                const f = from.get(key)
                if (!f || f.y0.length !== to.y0.length) { next.set(key, to); continue }
                next.set(key, {
                    y0: to.y0.map((v, i) => f.y0[i] + (v - f.y0[i]) * k),
                    y1: to.y1.map((v, i) => f.y1[i] + (v - f.y1[i]) * k),
                    o: f.o + (to.o - f.o) * k,
                })
            }
            current.current = next
            setShapes(next)
            if (k < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [targets])

    const area = useMemo(() => d3.area<number>().curve(d3.curveBasis), [])
    const pathOf = (s: Shape) => area.x((_, i) => x(yrs[i])).y0((_, i) => s.y0[i]).y1((_, i) => s.y1[i])(s.y0) ?? ''
    const colorOf = (k: Key) => (k[0] === 't' ? THEME_COLORS[k.slice(2) as Theme] : EMOTION_COLORS[k.slice(2) as Emotion])
    const labelOf = (k: Key) => (k[0] === 't' ? THEME_LABELS[k.slice(2) as Theme] : EMOTION_LABELS[k.slice(2) as Emotion])
    const keys: Key[] = [...TK, ...EK]
    const focus = isolated ?? hover

    // Labels sit where a stream is thickest.
    const labels = useMemo(() => {
        const out: { k: Key; x: number; y: number; size: number }[] = []
        for (const [k, s] of targets) {
            if (s.o < 0.2) continue
            if (mode === 'ridges') { out.push({ k, x: pad.l + 2, y: s.y0[0] - 5, size: phone ? 9 : 10 }); continue }
            let best = -1, bi = 0
            for (let i = 3; i < s.y0.length - 3; i++) { const t = Math.abs(s.y1[i] - s.y0[i]); if (t > best) { best = t; bi = i } }
            if (best < (phone ? 16 : 13)) continue
            const size = Math.min(phone ? 12 : 16, 9 + best / 9), half = labelOf(k).length * size * 0.3 + 4
            out.push({ k, x: Math.max(pad.l + half, Math.min(w - pad.r - half, x(yrs[bi]))), y: (s.y0[bi] + s.y1[bi]) / 2, size })
        }
        return out
    }, [targets, mode, x, yrs, phone, pad, w])

    const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
        const r = e.currentTarget.getBoundingClientRect()
        const yr = Math.round(x.invert(e.clientX - r.left))
        setCursor(Math.max(yrs[0], Math.min(yrs[yrs.length - 1], yr)))
    }

    // Mood strip: valence and energy over time.
    const moodTop = pad.t + chartH + 10
    const vY = d3.scaleLinear().domain(d3.extent(series.valence) as [number, number]).range([moodTop + moodStrip - 8, moodTop + 14])
    const eY = d3.scaleLinear().domain(d3.extent(series.energy) as [number, number]).range([moodTop + moodStrip - 8, moodTop + 14])
    const line = d3.line<number>().curve(d3.curveBasis)
    const vMid = d3.mean(series.valence) ?? 0
    const ci = cursor != null ? yrs.indexOf(cursor) : -1

    const switchMode = (m: Mode) => { setMode(m); setIsolated(null); setHover(null) }
    const panelKey = focus
    const share = panelKey && ci >= 0 ? (series.themes[panelKey] ?? series.emotions[panelKey])[ci] : null

    return (
        <div className="relative flex h-full flex-col overflow-hidden" style={{ background: INK.bg }}>
            <div className="pointer-events-none z-10 flex flex-wrap items-start justify-between gap-2 px-3 pt-3 sm:px-5 sm:pt-5">
                <div className="max-w-md">
                    <h2 className={TYPE.title}>{mode === 'moods' ? 'How the charts felt' : 'What we sang about'}</h2>
                    <p className={`${TYPE.annotation} mt-1 hidden sm:block`}>
                        {mode === 'moods' ? 'The main feeling of every hit, year by year, with brightness and drive traced below.' : 'Each stream is a theme, swelling and thinning as the charts moved on. Hover to light one up, click to follow it alone.'}
                    </p>
                </div>
                <ToggleGroup className="pointer-events-auto" variant="outline" size="sm" value={[mode]} onValueChange={(v: string[]) => v[0] && switchMode(v[0] as Mode)}>
                    <ToggleGroupItem value="river">River</ToggleGroupItem>
                    <ToggleGroupItem value="ridges">Ridges</ToggleGroupItem>
                    <ToggleGroupItem value="moods">Moods</ToggleGroupItem>
                </ToggleGroup>
            </div>

            <div ref={wrap} className="relative min-h-0 flex-1">
                {w > 0 && (
                    <svg width={w} height={h} className="absolute inset-0 block touch-pan-y select-none" onPointerMove={onMove} onPointerLeave={() => { setCursor(null); setHover(null) }}
                        onClick={(e) => { if (e.target === e.currentTarget) setIsolated(null) }}>
                        <defs>
                            <filter id="th-glow" x="-20%" y="-50%" width="140%" height="200%">
                                <feGaussianBlur stdDeviation="8" result="b" />
                                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                            <filter id="th-haze" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="16" /></filter>
                            <linearGradient id="th-val" gradientUnits="userSpaceOnUse" x1={x.range()[0]} x2={x.range()[1]}>
                                {yrs.map((yr, i) => <stop key={yr} offset={i / Math.max(1, yrs.length - 1)} stopColor={valenceColor((series.valence[i] - vMid) * 6)} />)}
                            </linearGradient>
                        </defs>

                        {DECADES.filter((d) => d >= yrs[0]).map((d) => (
                            <g key={d} pointerEvents="none">
                                <line x1={x(d)} x2={x(d)} y1={pad.t} y2={h - pad.b + 4} stroke={INK.grid} />
                                <text x={x(d) + 4} y={h - 8} fill={INK.axis} fontSize={10} className="font-mono">{phone ? `'${String(d).slice(2)}` : d}</text>
                            </g>
                        ))}

                        {/* A soft blurred copy underneath gives the river its glow. */}
                        <g filter="url(#th-haze)" opacity={0.4} pointerEvents="none">
                            {keys.map((k) => { const s = shapes.get(k); return s && s.o > 0.01 ? <path key={k} d={pathOf(s)} fill={colorOf(k)} opacity={s.o * (focus && focus !== k ? 0.1 : 1)} /> : null })}
                        </g>
                        <g>
                            {keys.map((k) => {
                                const s = shapes.get(k)
                                if (!s || s.o < 0.01) return null
                                const on = focus === k
                                return (
                                    <path key={k} d={pathOf(s)} fill={colorOf(k)} stroke={INK.bg} strokeWidth={mode === 'ridges' ? 1.2 : 0.5} strokeOpacity={0.7}
                                        opacity={s.o * (focus ? (on ? 1 : 0.16) : 0.88)}
                                        filter={on ? 'url(#th-glow)' : undefined}
                                        style={{ transition: 'opacity 250ms ease', cursor: 'pointer' }}
                                        onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(k)}
                                        onClick={(e) => { e.stopPropagation(); setIsolated(isolated === k ? null : k); setHover(null) }} />
                                )
                            })}
                        </g>

                        <g pointerEvents="none">
                            {labels.map((l) => (
                                <text key={l.k} x={l.x} y={l.y} dy="0.35em" textAnchor={mode === 'ridges' ? 'start' : 'middle'} fontSize={l.size}
                                    fill={mode === 'ridges' ? INK.text : INK.bg} fontWeight={600}
                                    stroke={mode === 'ridges' ? INK.bg : 'none'} strokeWidth={3} paintOrder="stroke"
                                    opacity={focus && focus !== l.k ? 0.15 : 0.85} style={{ transition: 'opacity 250ms' }}
                                    className="font-heading">{labelOf(l.k)}</text>
                            ))}
                        </g>

                        {mode === 'moods' && moodStrip > 0 && (
                            <g pointerEvents="none">
                                <path d={line.x((_, i) => x(yrs[i])).y((d) => eY(d))(series.energy) ?? ''} fill="none" stroke={INK.muted} strokeWidth={1.5} strokeDasharray="3 5" strokeOpacity={0.7} />
                                <path d={line.x((_, i) => x(yrs[i])).y((d) => vY(d))(series.valence) ?? ''} fill="none" stroke="url(#th-val)" strokeWidth={3} strokeLinecap="round" filter="url(#th-glow)" />
                                <text x={pad.l} y={moodTop} fill={INK.axis} fontSize={10} letterSpacing="0.12em">BRIGHTNESS ━  ·  ENERGY ┅</text>
                            </g>
                        )}

                        {cursor != null && (
                            <g pointerEvents="none">
                                <line x1={x(cursor)} x2={x(cursor)} y1={pad.t} y2={h - pad.b} stroke={INK.text} strokeOpacity={0.3} />
                                <rect x={x(cursor) - 20} y={h - pad.b + 3} width={40} height={16} rx={8} fill={INK.surface} />
                                <text x={x(cursor)} y={h - pad.b + 15} textAnchor="middle" fill={INK.text} fontSize={11} className="font-mono">{cursor}</text>
                            </g>
                        )}
                    </svg>
                )}
            </div>

            {panelKey && (
                // On phones the card sits below the chart (the chart shrinks to make room) so it never covers a stream.
                <div className="z-10 shrink-0 px-2 pb-2 sm:pointer-events-none sm:absolute sm:right-5 sm:bottom-10 sm:w-[380px] sm:p-0">
                    <Card size="sm" glass className="pointer-events-auto gap-0 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <span className="size-2.5 rounded-full" style={{ background: colorOf(panelKey), boxShadow: `0 0 12px ${colorOf(panelKey)}` }} />
                                <span className={TYPE.heading}>{labelOf(panelKey)}</span>
                                {share != null && <span className={`${TYPE.label} ${TYPE.number}`}>{cursor} · {(share * 100).toFixed(1)}%</span>}
                            </div>
                            {isolated && <Button size="sm" variant="ghost" className="-my-1 -mr-1 h-7 px-2 text-xs" onClick={() => setIsolated(null)}>Show all <X /></Button>}
                        </div>
                        <div className="mt-2 grid max-h-[22vh] sm:max-h-[30vh] grid-cols-2 gap-x-3 gap-y-1.5 overflow-y-auto">
                            {DECADES.map((d) => {
                                const songs = signature.get(panelKey)?.get(d)?.slice(0, phone ? 1 : 2)
                                if (!songs?.length) return null
                                return (
                                    <div key={d} className="min-w-0">
                                        <div className={`${TYPE.label} font-mono`}>{d}s</div>
                                        {songs.map((s) => (
                                            <div key={s.id} className="truncate text-xs" title={s.analysis?.summary}>
                                                <span className="text-foreground">{s.title}</span> <span className="text-muted-foreground">· {s.artist}</span>
                                            </div>
                                        ))}
                                    </div>
                                )
                            })}
                        </div>
                    </Card>
                </div>
            )}
        </div>
    )
}
