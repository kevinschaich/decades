// Where each subject sits in the song galaxy: every song as a faint star, each subject's songs lit in its color, and a
// glowing center of gravity that glides when the selection changes. Canvas, so thousands of points stay cheap.
import { useEffect, useRef } from 'react'
import type { Song } from '../../data'
import { INK } from '../../theme'

type Props = {
    all: Song[]
    groups: { id: string; color: string; label: string; songs: Song[]; centroid: [number, number] | null }[]
    highlight: Song | null
}

export function GalaxyMap({ all, groups, highlight }: Props) {
    const canvas = useRef<HTMLCanvasElement>(null)
    const state = useRef({ alpha: new Map<string, number>(), centers: new Map<string, [number, number]>() })

    useEffect(() => {
        const el = canvas.current
        if (!el) return
        const ctx = el.getContext('2d')!
        let raf = 0
        let w = 0
        let h = 0
        const resize = () => {
            const dpr = Math.min(2, devicePixelRatio)
            w = el.clientWidth
            h = el.clientHeight
            el.width = w * dpr
            el.height = h * dpr
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        }
        resize()
        const ro = new ResizeObserver(() => {
            resize()
            cancelAnimationFrame(raf)
            raf = requestAnimationFrame(draw)
        })
        ro.observe(el)
        const ids = new Set(groups.map((g) => g.id))
        const start = performance.now()
        const draw = (now: number) => {
            const t = Math.min(1, (now - start) / 800)
            const k = 1 - Math.pow(1 - t, 3)
            const pad = 14
            const sx = (x: number) => pad + x * (w - pad * 2)
            const sy = (y: number) => pad + y * (h - pad * 2)
            ctx.clearRect(0, 0, w, h)
            ctx.fillStyle = INK.muted
            ctx.globalAlpha = 0.13
            for (const s of all) if (s.galaxy) ctx.fillRect(sx(s.galaxy[0]) - 0.6, sy(s.galaxy[1]) - 0.6, 1.2, 1.2)
            ctx.globalCompositeOperation = 'lighter'
            const st = state.current
            for (const id of [...st.alpha.keys()]) if (!ids.has(id)) st.alpha.delete(id)
            for (const g of groups) {
                const a0 = st.alpha.get(g.id) ?? 0
                const a = a0 + (1 - a0) * k
                if (t >= 1) st.alpha.set(g.id, 1)
                ctx.fillStyle = g.color
                ctx.globalAlpha = 0.55 * a
                const r = g.songs.length > 400 ? 1.1 : g.songs.length > 80 ? 1.6 : 2.4
                for (const s of g.songs) {
                    if (!s.galaxy) continue
                    ctx.beginPath()
                    ctx.arc(sx(s.galaxy[0]), sy(s.galaxy[1]), r, 0, Math.PI * 2)
                    ctx.fill()
                }
            }
            ctx.globalCompositeOperation = 'source-over'
            for (const g of groups) {
                if (!g.centroid) continue
                const prev = st.centers.get(g.id) ?? g.centroid
                const c: [number, number] = [prev[0] + (g.centroid[0] - prev[0]) * k, prev[1] + (g.centroid[1] - prev[1]) * k]
                if (t >= 1) st.centers.set(g.id, g.centroid)
                const x = sx(c[0])
                const y = sy(c[1])
                const glow = ctx.createRadialGradient(x, y, 0, x, y, 34)
                glow.addColorStop(0, g.color)
                glow.addColorStop(1, 'transparent')
                ctx.globalAlpha = 0.45
                ctx.fillStyle = glow
                ctx.fillRect(x - 34, y - 34, 68, 68)
                ctx.globalAlpha = 1
                ctx.fillStyle = INK.bg
                ctx.strokeStyle = g.color
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.arc(x, y, 5.5, 0, Math.PI * 2)
                ctx.fill()
                ctx.stroke()
                ctx.font = '600 12px var(--font-heading, sans-serif)'
                ctx.textAlign = x > w * 0.7 ? 'right' : 'left'
                ctx.fillStyle = INK.text
                ctx.shadowColor = INK.bg
                ctx.shadowBlur = 6
                ctx.fillText(g.label, x + (x > w * 0.7 ? -10 : 10), y + 4)
                ctx.shadowBlur = 0
            }
            if (highlight?.galaxy) {
                const x = sx(highlight.galaxy[0])
                const y = sy(highlight.galaxy[1])
                const pulse = 7 + Math.sin(now / 180) * 2
                ctx.globalAlpha = 1
                ctx.strokeStyle = INK.text
                ctx.lineWidth = 1.5
                ctx.beginPath()
                ctx.arc(x, y, pulse, 0, Math.PI * 2)
                ctx.stroke()
            }
            ctx.globalAlpha = 1
            if (t < 1 || highlight) raf = requestAnimationFrame(draw)
        }
        raf = requestAnimationFrame(draw)
        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
        }
    }, [all, groups, highlight])

    return <canvas ref={canvas} className="block h-full w-full" aria-label="Where each selection sits among all songs" role="img" />
}
