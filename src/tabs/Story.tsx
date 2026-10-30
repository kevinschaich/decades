// Story: a scrollytelling journey from 1950 to now. A sticky canvas of every song morphs between layouts
// (galaxy, timeline, theme bands per decade, turning points, theme families, mood) as captions scroll past.
import { Card, CardContent } from '@kevinschaich/components'
import * as d3 from 'd3'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Data, Song } from '../data'
import { INK, THEME_COLORS, THEME_LABELS, TYPE } from '../theme'
import { makeLayouts, PALETTE } from './story/layouts'
import { buildStory, type Spark, type Step } from './story/model'
import { Scene, type Plot } from './story/scene'

export function Story({ data }: { data: Data }) {
    const songs = useMemo(() => data.songs.filter((s) => s.analysis), [data])
    const steps = useMemo(() => buildStory(data), [data])
    const layouts = useMemo(() => makeLayouts(data, songs), [data, songs])
    const index = useMemo(() => new Map(songs.map((s, i) => [s.id, i])), [songs])

    const scroller = useRef<HTMLDivElement>(null)
    const canvas = useRef<HTMLCanvasElement>(null)
    const scene = useRef<Scene | null>(null)
    const [size, setSize] = useState({ w: 0, h: 0 })
    const [active, setActive] = useState(0)
    const [tip, setTip] = useState<{ song: Song; x: number; y: number } | null>(null)
    const wide = size.w >= 768

    // Canvas and plot area: beside the captions on wide screens, above them on phones.
    useEffect(() => {
        const el = scroller.current!
        const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
        ro.observe(el)
        return () => ro.disconnect()
    }, [])
    useEffect(() => {
        if (!canvas.current || !size.w) return
        scene.current ??= new Scene(canvas.current, songs.length, PALETTE)
        const left = Math.min(470, size.w * 0.42)
        const plot: Plot = wide ? { x: left, y: 40, w: size.w - left - 36, h: size.h - 90 } : { x: 32, y: 40, w: size.w - 52, h: size.h * 0.46 }
        scene.current.resize(size.w, size.h, plot)
    }, [size, wide, songs.length])
    useEffect(() => () => scene.current?.destroy(), [])

    // The step crossing the middle of the view is the active one.
    useEffect(() => {
        const root = scroller.current!
        const io = new IntersectionObserver(
            (entries) => {
                for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step))
            },
            { root, rootMargin: '-50% 0px -50% 0px' },
        )
        root.querySelectorAll('[data-step]').forEach((el) => io.observe(el))
        return () => io.disconnect()
    }, [steps])

    const step = steps[active]
    const standout = step.song ? (index.get(step.song.id) ?? -1) : -1
    useEffect(() => {
        const s = scene.current
        if (!s || !size.w) return
        s.set(layouts[step.layout](step.decade))
        s.hover = standout
        setTip(null)
    }, [step, layouts, standout, size.w])

    function onPointer(e: React.PointerEvent) {
        const s = scene.current
        if (!s) return
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const i = s.pick(e.clientX - r.left, e.clientY - r.top, e.pointerType === 'touch' ? 24 : 14)
        s.hover = i >= 0 ? i : standout
        s.kick()
        if (i < 0) return setTip(null)
        const [x, y] = s.at(i)
        setTip({ song: songs[i], x, y })
    }

    const decadeWord = step.decade ? `${step.decade}s` : null
    return (
        <div ref={scroller} className="relative h-full overflow-y-auto overscroll-contain" style={{ background: INK.bg }}>
            <div className="relative">
            <div className="pointer-events-none absolute inset-0">
                <div
                    className="pointer-events-auto sticky top-0 overflow-hidden"
                    style={{ height: size.h || '100%' }}
                    onPointerMove={(e) => e.pointerType === 'mouse' && onPointer(e)}
                    onPointerDown={onPointer}
                    onPointerLeave={() => setTip(null)}
                >
                    <AnimatePresence>
                        {decadeWord && (
                            <motion.div
                                key={decadeWord}
                                initial={{ opacity: 0, y: 24 }}
                                animate={{ opacity: 0.08, y: 0 }}
                                exit={{ opacity: 0, y: -24 }}
                                transition={{ duration: 0.8 }}
                                className={`${TYPE.display} pointer-events-none absolute right-4 top-2 select-none sm:right-10 sm:text-[9rem]`}
                            >
                                {decadeWord}
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <canvas ref={canvas} className="absolute inset-0" />
                    <Progress steps={steps} active={active} wide={wide} />
                    {tip && <SongTip tip={tip} w={size.w} />}
                </div>
            </div>
            <div className="pointer-events-none relative">
                {steps.map((s, i) => (
                    <section
                        key={s.id}
                        data-step={i}
                        className={`flex px-4 sm:px-8 ${wide ? 'items-center' : 'items-end pb-[5vh]'}`}
                        style={{ minHeight: (size.h || 600) * 1.1 }}
                    >
                        <StepCard step={s} on={i === active} wide={wide} />
                    </section>
                ))}
                <div style={{ height: (size.h || 600) * 0.3 }} />
            </div>
            </div>
        </div>
    )
}

function StepCard({ step, on, wide }: { step: Step; on: boolean; wide: boolean }) {
    return (
        <motion.div
            animate={{ opacity: on ? 1 : 0.2, y: on ? 0 : 16 }}
            transition={{ duration: 0.5 }}
            className={`pointer-events-auto w-full ${wide ? 'max-w-[410px]' : 'max-h-[44vh] overflow-y-auto rounded-xl'}`}
        >
            <Card className="border-white/10 bg-[oklch(0.16_0.006_285/0.82)] backdrop-blur-md">
                <CardContent className="space-y-3">
                    <p className={TYPE.label}>{step.kicker}</p>
                    <h2 className={TYPE.title}>{step.title}</h2>
                    <p className={TYPE.body}>{step.body}</p>
                    {step.spark && <Sparkline spark={step.spark} />}
                    {step.song && <Standout song={step.song} />}
                </CardContent>
            </Card>
        </motion.div>
    )
}

function Standout({ song }: { song: Song }) {
    const a = song.analysis!
    const t = a.primaryTheme
    const ones = song.charts.filter((c) => c.rank === 1).map((c) => c.year)
    return (
        <div className="border-t border-white/10 pt-3">
            <p className={TYPE.label}>Standout · No. 1 of {ones.join(', ')}</p>
            <p className="mt-1 font-heading font-semibold">
                {song.title} <span className="font-normal text-muted-foreground">· {song.artist}</span>
            </p>
            <p className="mt-1 text-sm leading-relaxed text-foreground/80">{a.summary}</p>
            {t && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="size-2 rounded-full" style={{ background: THEME_COLORS[t] }} />
                    {THEME_LABELS[t]}
                </p>
            )}
        </div>
    )
}

function Sparkline({ spark }: { spark: Spark }) {
    const W = 320, H = 64
    const x = d3.scaleLinear().domain(d3.extent(spark.points, (p) => p[0]) as [number, number]).range([2, W - 2])
    const y = d3.scaleLinear().domain([Math.min(0, d3.min(spark.points, (p) => p[1])!), d3.max(spark.points, (p) => p[1])! * 1.1]).range([H - 2, 4])
    const line = d3.line<[number, number]>().x((p) => x(p[0])).y((p) => y(p[1])).curve(d3.curveMonotoneX)
    const area = d3.area<[number, number]>().x((p) => x(p[0])).y0(H).y1((p) => y(p[1])).curve(d3.curveMonotoneX)
    const id = `spark-${spark.label.replace(/\W/g, '')}`
    return (
        <div>
            <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full overflow-visible" preserveAspectRatio="none">
                <defs>
                    <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0" stopColor={INK.text} stopOpacity={0.18} />
                        <stop offset="1" stopColor={INK.text} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <path d={area(spark.points)!} fill={`url(#${id})`} />
                <motion.path d={line(spark.points)!} fill="none" stroke={INK.text} strokeWidth={1.5} vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: 'easeInOut' }} />
                {spark.mark != null && <line x1={x(spark.mark)} x2={x(spark.mark)} y1={0} y2={H} stroke={INK.axis} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />}
            </svg>
            <div className="mt-1 flex justify-between gap-2 text-[11px] text-muted-foreground">
                <span>{spark.points[0][0]}</span>
                <span className="text-center">{spark.label}</span>
                <span>{spark.points.at(-1)![0]}</span>
            </div>
        </div>
    )
}

function Progress({ steps, active, wide }: { steps: Step[]; active: number; wide: boolean }) {
    return (
        <div className={`pointer-events-none absolute flex gap-1.5 ${wide ? 'right-3 top-1/2 -translate-y-1/2 flex-col' : 'left-1/2 top-1.5 -translate-x-1/2'}`}>
            {steps.map((s, i) => (
                <span
                    key={s.id}
                    className="rounded-full transition-all duration-500"
                    style={{ width: wide || i !== active ? 4 : 14, height: wide && i === active ? 14 : 4, background: i === active ? INK.text : INK.axis }}
                />
            ))}
        </div>
    )
}

function SongTip({ tip, w }: { tip: { song: Song; x: number; y: number }; w: number }) {
    const { song } = tip
    const width = Math.min(280, w - 24)
    const left = Math.max(12, Math.min(w - width - 12, tip.x - width / 2))
    const below = tip.y < 200
    return (
        <div className="pointer-events-none absolute z-10" style={{ left, top: below ? tip.y + 14 : undefined, bottom: below ? undefined : `calc(100% - ${tip.y - 14}px)`, width }}>
            <Card size="sm" className="border-white/10 bg-[oklch(0.18_0.006_285/0.95)] shadow-xl">
                <CardContent className="space-y-1">
                    <p className="font-heading text-sm font-semibold leading-snug">{song.title}</p>
                    <p className="text-xs text-muted-foreground">
                        {song.artist} · {song.year} · best No. {song.bestRank}
                    </p>
                    <p className="line-clamp-4 text-xs leading-relaxed text-foreground/80">{song.analysis?.summary}</p>
                </CardContent>
            </Card>
        </div>
    )
}
