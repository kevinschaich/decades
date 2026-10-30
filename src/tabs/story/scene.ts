// A canvas of glowing points that morphs between layouts. Thousands of songs at 60 fps: each point is a
// pre-rendered sprite drawn with drawImage, and the loop only runs while something moves.
import { INK } from '../../theme'
import type { Frame } from './layouts'

export type Plot = { x: number; y: number; w: number; h: number }
const DURATION = 1400, STAGGER = 450

export class Scene {
    private ctx: CanvasRenderingContext2D
    private n: number
    private fromX: Float32Array; private fromY: Float32Array
    private curX: Float32Array; private curY: Float32Array
    private fromA: Float32Array; private curA: Float32Array
    private fromC: Uint16Array
    private frame: Frame | null = null
    private start = 0
    private delay: Float32Array
    private sprites: HTMLCanvasElement[] = []
    private raf = 0
    private labelAlpha = 1
    plot: Plot = { x: 0, y: 0, w: 1, h: 1 }
    hover = -1
    private dpr = 1
    private font = getComputedStyle(document.body).fontFamily || 'system-ui'
    private w = 1; private h = 1

    constructor(private canvas: HTMLCanvasElement, n: number, private palette: string[]) {
        this.ctx = canvas.getContext('2d')!
        this.n = n
        this.fromX = new Float32Array(n); this.fromY = new Float32Array(n)
        this.curX = new Float32Array(n); this.curY = new Float32Array(n)
        this.fromA = new Float32Array(n); this.curA = new Float32Array(n)
        this.fromC = new Uint16Array(n)
        this.delay = new Float32Array(n)
        // Points start scattered near the center and bloom into the first layout.
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, r = Math.random() * 0.05
            this.curX[i] = 0.5 + Math.cos(a) * r; this.curY[i] = 0.5 + Math.sin(a) * r
        }
    }

    resize(w: number, h: number, plot: Plot) {
        this.dpr = Math.min(2, window.devicePixelRatio || 1)
        this.w = w; this.h = h; this.plot = plot
        this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr)
        this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`
        this.makeSprites()
        this.kick()
    }

    /** Point radius in CSS px: small enough that a full year column of songs fits. */
    get radius() {
        return Math.max(1.1, Math.min(3.2, this.plot.h / 220, this.plot.w / 170))
    }

    private makeSprites() {
        const r = this.radius * this.dpr, size = Math.ceil(r * 6)
        this.sprites = this.palette.map((c) => {
            const s = document.createElement('canvas')
            s.width = s.height = size
            const g = s.getContext('2d')!
            g.fillStyle = c
            g.globalAlpha = 0.18
            g.beginPath(); g.arc(size / 2, size / 2, r * 2.6, 0, Math.PI * 2); g.fill()
            g.globalAlpha = 1
            g.beginPath(); g.arc(size / 2, size / 2, r, 0, Math.PI * 2); g.fill()
            return s
        })
    }

    set(frame: Frame, instant = false) {
        if (this.frame) for (let i = 0; i < this.n; i++) this.fromC[i] = this.frame.color[i]
        else this.fromC.set(frame.color)
        this.fromX.set(this.curX); this.fromY.set(this.curY); this.fromA.set(this.curA)
        // Stagger by horizontal position so changes sweep across the canvas like a wave.
        for (let i = 0; i < this.n; i++) this.delay[i] = Math.min(1, Math.max(0, frame.x[i])) * STAGGER + Math.random() * 120
        this.frame = frame
        this.start = instant ? -1e9 : performance.now()
        this.labelAlpha = 0
        this.kick()
    }

    kick() {
        if (!this.raf) this.raf = requestAnimationFrame(this.tick)
    }

    destroy() {
        cancelAnimationFrame(this.raf)
    }

    /** Nearest lit point to (px, py) in CSS px, or -1. */
    pick(px: number, py: number, max = 18): number {
        if (!this.frame) return -1
        const { x, y, w, h } = this.plot
        let best = -1, bd = max * max
        for (let i = 0; i < this.n; i++) {
            if (this.curA[i] < 0.5) continue
            const dx = x + this.curX[i] * w - px, dy = y + this.curY[i] * h - py
            const d = dx * dx + dy * dy
            if (d < bd) (bd = d), (best = i)
        }
        return best
    }

    /** Screen position of point i in CSS px. */
    at(i: number): [number, number] {
        return [this.plot.x + this.curX[i] * this.plot.w, this.plot.y + this.curY[i] * this.plot.h]
    }

    private tick = (now: number) => {
        this.raf = 0
        const f = this.frame
        const ctx = this.ctx
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
        ctx.clearRect(0, 0, this.w, this.h)
        if (!f) return
        const t0 = now - this.start
        let moving = false
        const { x: px, y: py, w: pw, h: ph } = this.plot
        const half = this.sprites[0]?.width / this.dpr / 2 || 0
        const dims: number[] = []
        const lit: number[] = []
        for (let i = 0; i < this.n; i++) {
            let k = (t0 - this.delay[i]) / DURATION
            if (k < 1) moving = true
            k = k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
            this.curX[i] = this.fromX[i] + (f.x[i] - this.fromX[i]) * k
            this.curY[i] = this.fromY[i] + (f.y[i] - this.fromY[i]) * k
            this.curA[i] = this.fromA[i] + (f.bright[i] - this.fromA[i]) * k
            ;(this.curA[i] > 0.5 ? lit : dims).push(i)
            if (k >= 0.5) this.fromC[i] = f.color[i] // colors swap halfway through the move
        }
        for (const list of [dims, lit]) {
            for (const i of list) {
                const a = 0.1 + 0.9 * this.curA[i]
                ctx.globalAlpha = a
                ctx.drawImage(this.sprites[this.fromC[i]], px + this.curX[i] * pw - half, py + this.curY[i] * ph - half, half * 2, half * 2)
            }
        }
        ctx.globalAlpha = 1
        if (this.hover >= 0) {
            const [hx, hy] = this.at(this.hover)
            ctx.strokeStyle = INK.text
            ctx.lineWidth = 1.5
            ctx.beginPath(); ctx.arc(hx, hy, this.radius + 4, 0, Math.PI * 2); ctx.stroke()
        }
        // Axis labels fade in once the points settle.
        this.labelAlpha = Math.min(1, Math.max(0, (t0 - DURATION * 0.6) / 500))
        if (this.labelAlpha < 1) moving = true
        ctx.globalAlpha = this.labelAlpha
        ctx.fillStyle = INK.muted
        ctx.font = `11px ${this.font}`
        ctx.textBaseline = 'middle'
        for (const l of f.labels) {
            ctx.textAlign = l.align ?? 'center'
            ctx.fillText(l.text, px + l.u * pw, py + l.v * ph)
        }
        ctx.globalAlpha = 1
        if (moving) this.kick()
    }
}
