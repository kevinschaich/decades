// Every song as a point: x is the year it first charted, y the chosen measure. Within a year the points spread to
// the shape of that year's distribution, so each column reads as a violin. Canvas keeps thousands of points at 60 fps;
// switching measures glides every point to its new place.
import * as d3 from 'd3'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Song } from '../../data'
import { DECADE_COLORS, INK } from '../../theme'
import { hash01, outliers, violinOffsets, yScale, yearStats, type MetricDef } from './model'

const M = { top: 18, right: 14, bottom: 26, left: 46 }

export function Swarm({ songs, def, selected, onSelect }: { songs: Song[]; def: MetricDef; selected: Song | null; onSelect: (s: Song | null) => void }) {
    const wrap = useRef<HTMLDivElement>(null)
    const canvas = useRef<HTMLCanvasElement>(null)
    const [size, setSize] = useState({ w: 0, h: 0 })
    const [hover, setHover] = useState<Song | null>(null)
    const anim = useRef({ from: null as Float32Array | null, to: null as Float32Array | null, cur: null as Float32Array | null, t0: 0 })

    useEffect(() => {
        const el = wrap.current!
        const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const years = d3.extent(songs, (s) => s.year) as [number, number]
    const iw = Math.max(10, size.w - M.left - M.right), ih = Math.max(10, size.h - M.top - M.bottom)
    const x = useMemo(() => d3.scaleLinear().domain([years[0] - 0.5, years[1] + 0.5]).range([0, iw]), [years[0], years[1], iw])
    const y = useMemo(() => yScale(def, [ih, 0]), [def, ih])
    const stats = useMemo(() => yearStats(songs, def), [songs, def])
    const notable = useMemo(() => outliers(songs, def), [songs, def])

    // target positions [x, y] interleaved
    const target = useMemo(() => {
        const col = iw / (years[1] - years[0] + 1)
        const off = violinOffsets(songs, def, (v) => ih - y(v), ih)
        const out = new Float32Array(songs.length * 2)
        songs.forEach((s, i) => {
            let v = def.get(s)
            if (v == null) { out[i * 2] = x(s.year); out[i * 2 + 1] = ih + 40; return }
            if (def.jitter) v += (hash01(s.id, 3) * 2 - 1) * def.jitter
            out[i * 2] = x(s.year) + off[i] * col * 0.5
            out[i * 2 + 1] = y(v)
        })
        return out
    }, [songs, def, x, y, iw, ih, years[0], years[1]])

    useEffect(() => {
        const a = anim.current
        if (!a.cur) {
            // first entrance: rise from the baseline
            a.from = new Float32Array(target)
            for (let i = 1; i < a.from.length; i += 2) a.from[i] = ih
        } else a.from = new Float32Array(a.cur)
        a.to = target
        a.cur = new Float32Array(a.from)
        a.t0 = performance.now()
    }, [target])

    // the draw loop runs only while points are moving or the pointer changes
    const draw = useRef<() => boolean>(() => false)
    draw.current = () => {
        const c = canvas.current, a = anim.current
        if (!c || !a.to || !a.from || !a.cur || size.w === 0) return false
        const dpr = Math.min(2, devicePixelRatio)
        if (c.width !== Math.round(size.w * dpr)) { c.width = Math.round(size.w * dpr); c.height = Math.round(size.h * dpr) }
        const g = c.getContext('2d')!
        g.setTransform(dpr, 0, 0, dpr, 0, 0)
        g.clearRect(0, 0, size.w, size.h)
        g.translate(M.left, M.top)

        const now = performance.now()
        let moving = false
        const n = songs.length
        for (let i = 0; i < n; i++) {
            // stagger by year so the change sweeps across time
            const delay = ((songs[i].year - years[0]) / (years[1] - years[0] + 1)) * 350
            const t = Math.max(0, Math.min(1, (now - a.t0 - delay) / 900))
            if (t < 1) moving = true
            const e = d3.easeCubicInOut(t)
            a.cur[i * 2] = a.from[i * 2] + (a.to[i * 2] - a.from[i * 2]) * e
            a.cur[i * 2 + 1] = a.from[i * 2 + 1] + (a.to[i * 2 + 1] - a.from[i * 2 + 1]) * e
        }

        // gridlines and axis labels
        g.font = '10px var(--font-mono, ui-monospace)'
        g.fillStyle = INK.muted
        g.strokeStyle = INK.grid
        g.lineWidth = 1
        const ticks: [number, string][] = def.ticks ?? y.ticks(5).map((t) => [t, def.fmt(t).replace(/ (words|letters|per 100 words)$/, '')])
        g.textAlign = 'right'; g.textBaseline = 'middle'
        for (const [t, label] of ticks) {
            const ty = y(t)
            g.beginPath(); g.moveTo(0, ty); g.lineTo(iw, ty); g.stroke()
            g.fillText(label, -8, ty)
        }
        g.textAlign = 'center'; g.textBaseline = 'top'
        const step = iw < 500 ? 20 : 10
        for (let yr = Math.ceil(years[0] / step) * step; yr <= years[1]; yr += step) g.fillText(String(yr), x(yr), ih + 10)

        // the middle half of each year, as a soft band, drawn once points have mostly settled
        const settle = Math.max(0, Math.min(1, (now - a.t0 - 500) / 600))
        if (stats.length) {
            const area = d3.area<(typeof stats)[number]>().x((d) => x(d.year)).y0((d) => y(d.q1)).y1((d) => y(d.q3)).curve(d3.curveCatmullRom).context(g)
            g.globalAlpha = 0.09 * settle
            g.fillStyle = INK.text
            g.beginPath(); area(stats); g.fill()
            g.globalAlpha = 1
        }

        // points, by decade color
        const r = iw < 500 ? 1.3 : 1.8
        let lastColor = ''
        g.globalAlpha = hover || selected ? 0.35 : 0.7
        for (let i = 0; i < n; i++) {
            const col = DECADE_COLORS[songs[i].decade] ?? INK.muted
            if (col !== lastColor) { g.fillStyle = col; lastColor = col }
            g.fillRect(a.cur[i * 2] - r, a.cur[i * 2 + 1] - r, r * 2, r * 2)
        }
        g.globalAlpha = 1

        // the typical value per year, as a glowing line
        if (stats.length) {
            const line = d3.line<(typeof stats)[number]>().x((d) => x(d.year)).y((d) => y(d.stat)).curve(d3.curveCatmullRom).context(g)
            g.globalAlpha = settle
            g.shadowColor = 'oklch(1 0 0 / 0.6)'; g.shadowBlur = 10
            g.strokeStyle = INK.text; g.lineWidth = 2
            g.beginPath(); line(stats); g.stroke()
            g.shadowBlur = 0
            g.globalAlpha = 1
        }

        // notable songs, labelled
        const idx = new Map(songs.map((s, i) => [s, i]))
        g.font = '11px var(--font-sans, system-ui)'
        for (const o of notable) {
            const i = idx.get(o.song)
            if (i == null) continue
            const px = a.cur[i * 2], py = a.cur[i * 2 + 1]
            g.globalAlpha = settle
            g.strokeStyle = INK.text; g.lineWidth = 1.2
            g.beginPath(); g.arc(px, py, 4.5, 0, Math.PI * 2); g.stroke()
            const label = o.song.title.length > 22 ? o.song.title.slice(0, 21) + '…' : o.song.title
            const right = px < iw * 0.7
            g.textAlign = right ? 'left' : 'right'; g.textBaseline = 'middle'
            const ly = Math.max(6, Math.min(ih - 6, py + (o.high ? -10 : 10)))
            g.fillStyle = INK.bg; g.globalAlpha = 0.75 * settle
            const w = g.measureText(label).width
            g.fillRect(right ? px + 6 : px - 10 - w, ly - 7, w + 4, 14)
            g.globalAlpha = settle
            g.fillStyle = INK.text
            g.fillText(label, right ? px + 8 : px - 8, ly)
        }
        g.globalAlpha = 1

        for (const [s, strong] of [[hover, false], [selected, true]] as const) {
            if (!s) continue
            const i = idx.get(s)
            if (i == null) continue
            const px = a.cur[i * 2], py = a.cur[i * 2 + 1]
            g.fillStyle = DECADE_COLORS[s.decade] ?? INK.text
            g.beginPath(); g.arc(px, py, strong ? 5 : 4, 0, Math.PI * 2); g.fill()
            g.strokeStyle = INK.text; g.lineWidth = 2
            g.beginPath(); g.arc(px, py, strong ? 8 : 6.5, 0, Math.PI * 2); g.stroke()
        }
        return moving || settle < 1
    }

    useEffect(() => {
        let raf = 0
        const tick = () => { if (draw.current()) raf = requestAnimationFrame(tick) }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [target, size, hover, selected, notable, stats])

    const quad = useMemo(() => {
        const q = d3.quadtree<number>().x((i) => target[i * 2]).y((i) => target[i * 2 + 1])
        for (let i = 0; i < songs.length; i++) if (target[i * 2 + 1] <= ih) q.add(i)
        return q
    }, [target, songs, ih])

    const pick = (e: React.PointerEvent) => {
        const r = canvas.current!.getBoundingClientRect()
        const i = quad.find(e.clientX - r.left - M.left, e.clientY - r.top - M.top, e.pointerType === 'touch' ? 22 : 12)
        return i == null ? null : songs[i]
    }

    const tip = hover && !selected ? (() => {
        const i = songs.indexOf(hover)
        const v = def.get(hover)
        return { x: target[i * 2] + M.left, y: target[i * 2 + 1] + M.top, v }
    })() : null

    return (
        <div ref={wrap} className="absolute inset-0">
            <canvas
                ref={canvas}
                className="absolute inset-0 h-full w-full cursor-crosshair touch-pan-y"
                onPointerMove={(e) => e.pointerType !== 'touch' && setHover(pick(e))}
                onPointerLeave={() => setHover(null)}
                onClick={(e) => onSelect(pick(e as unknown as React.PointerEvent))}
            />
            {tip && hover && (
                <div
                    className="pointer-events-none absolute z-10 max-w-56 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover/95 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur"
                    style={{ left: Math.max(80, Math.min(size.w - 80, tip.x)), top: tip.y - 12 }}
                >
                    <div className="truncate font-medium">{hover.title}</div>
                    <div className="truncate text-muted-foreground">{hover.artist} · {hover.year}</div>
                    {tip.v != null && <div className="font-mono tabular-nums">{def.fmt(tip.v)}</div>}
                </div>
            )}
        </div>
    )
}
