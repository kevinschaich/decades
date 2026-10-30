// Who the songs are about: each year's share of I / you / we / they, drawn in as the section scrolls into view.
import * as d3 from 'd3'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { INK } from '../../theme'
import { PRONOUNS, type pronounSeries } from './model'

export function Pronouns({ series }: { series: ReturnType<typeof pronounSeries> }) {
    const ref = useRef<HTMLDivElement>(null)
    const [w, setW] = useState(0)
    useEffect(() => {
        const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
        ro.observe(ref.current!)
        return () => ro.disconnect()
    }, [])
    const h = w < 500 ? 220 : 280
    const m = { top: 12, right: 44, bottom: 24, left: 36 }
    const iw = Math.max(10, w - m.left - m.right), ih = h - m.top - m.bottom
    const x = d3.scaleLinear().domain(d3.extent(series, (r) => r.year) as [number, number]).range([0, iw])
    const max = d3.max(series, (r) => d3.max(r.shares))!
    const y = d3.scaleLinear().domain([0, Math.ceil(max * 10) / 10]).range([ih, 0])
    const last = series[series.length - 1]
    const step = iw < 400 ? 20 : 10
    // end labels, nudged apart so close lines don't print on top of each other
    const labelY = PRONOUNS.map((_, k) => ({ k, y: y(last.shares[k]) })).sort((a, b) => a.y - b.y)
    for (let i = 1; i < labelY.length; i++) labelY[i].y = Math.max(labelY[i].y, labelY[i - 1].y + 14)
    const ly = (k: number) => labelY.find((l) => l.k === k)!.y
    return (
        <div ref={ref} className="w-full">
            {w > 0 && (
                <svg width={w} height={h} className="block overflow-visible">
                    <g transform={`translate(${m.left},${m.top})`}>
                        {y.ticks(4).map((t) => (
                            <g key={t} transform={`translate(0,${y(t)})`}>
                                <line x2={iw} stroke={INK.grid} />
                                <text x={-8} dy="0.32em" textAnchor="end" fontSize={10} fill={INK.muted} className="font-mono">{Math.round(t * 100)}%</text>
                            </g>
                        ))}
                        {d3.range(Math.ceil(x.domain()[0] / step) * step, x.domain()[1] + 1, step).map((yr) => (
                            <text key={yr} x={x(yr)} y={ih + 16} textAnchor="middle" fontSize={10} fill={INK.muted} className="font-mono">{yr}</text>
                        ))}
                        {PRONOUNS.map((p, k) => {
                            const d = d3.line<(typeof series)[number]>().x((r) => x(r.year)).y((r) => y(r.shares[k])).curve(d3.curveCatmullRom)(series)!
                            const hero = p.label === 'I'
                            return (
                                <g key={p.id}>
                                    <motion.path
                                        d={d} fill="none" stroke={p.color} strokeWidth={hero ? 3 : 1.75} strokeLinecap="round"
                                        style={hero ? { filter: `drop-shadow(0 0 6px ${p.color})` } : undefined}
                                        initial={{ pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: hero ? 1 : 0.8 }}
                                        viewport={{ once: true, amount: 0.4 }} transition={{ duration: 2.2, delay: k * 0.15, ease: 'easeInOut' }}
                                    />
                                    <motion.text
                                        x={iw + 6} y={ly(k)} dy="0.32em" fontSize={hero ? 14 : 12} fontWeight={hero ? 700 : 500} fill={p.color}
                                        initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 2.2 + k * 0.15 }}
                                    >
                                        {p.label}
                                    </motion.text>
                                </g>
                            )
                        })}
                    </g>
                </svg>
            )}
        </div>
    )
}
