// The fingerprint: one spoke per feature, a glowing closed curve per subject, and the all-time average as a faint
// dashed outline for reference. Values morph when the selection or facet changes.
import * as d3 from 'd3'
import { useMemo } from 'react'
import { INK } from '../../theme'
import { FEATURES } from './model'
import { useTween } from './useTween'

type Props = {
    size: number
    axes: number[] // feature indices
    series: { id: string; color: string; values: number[] }[] // raw means, same order as axes
    average: number[]
    facet: string
}

export function Radar({ size, axes, series, average, facet }: Props) {
    // Scale each spoke to the largest value shown on it, so small but distinctive features still read.
    const target = useMemo(() => {
        const max = axes.map((_, a) => Math.max(average[a] * 1.4, ...series.map((s) => s.values[a]), 1e-4))
        const out: Record<string, number[]> = { __avg: average.map((v, a) => Math.sqrt(v / max[a])) }
        for (const s of series) out[s.id] = s.values.map((v, a) => Math.sqrt(v / max[a]))
        return out
    }, [axes, series, average])
    const shown = useTween(target)

    const compact = size < 460
    const pad = compact ? 68 : 92
    const R = size / 2 - pad
    const n = axes.length
    const angle = (i: number) => (i / n) * Math.PI * 2
    const line = d3.lineRadial<number>().angle((_, i) => angle(i)).radius((v) => 6 + v * (R - 6)).curve(d3.curveCatmullRomClosed.alpha(0.5))
    const showLabel = (i: number) => !compact || n <= 16 || Object.entries(shown).some(([k, v]) => k !== '__avg' && (v[i] ?? 0) > 0.72)

    return (
        <svg viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} width={size} height={size} role="img" aria-label={`${facet} fingerprint`} className="block select-none">
            <defs>
                <filter id="cmp-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="6" />
                </filter>
                {series.map((s) => (
                    <radialGradient key={s.id} id={`cmp-fill-${s.id.replace(/[^a-z0-9]/gi, '')}`}>
                        <stop offset="0%" stopColor={s.color} stopOpacity={0.04} />
                        <stop offset="100%" stopColor={s.color} stopOpacity={0.28} />
                    </radialGradient>
                ))}
            </defs>
            {[0.25, 0.5, 0.75, 1].map((k) => (
                <circle key={k} r={6 + Math.sqrt(k) * (R - 6)} fill="none" stroke={INK.grid} />
            ))}
            {axes.map((f, i) => {
                const a = angle(i) - Math.PI / 2
                return <line key={f} x1={0} y1={0} x2={Math.cos(a) * R} y2={Math.sin(a) * R} stroke={INK.grid} />
            })}
            {shown.__avg && <path d={line(shown.__avg) ?? ''} fill="none" stroke={INK.axis} strokeDasharray="3 4" strokeWidth={1} />}
            {series.map((s) => {
                const v = shown[s.id]
                if (!v || v.length !== n) return null
                const d = line(v) ?? ''
                return (
                    <g key={s.id} style={{ mixBlendMode: 'screen' }}>
                        <path d={d} fill="none" stroke={s.color} strokeWidth={5} opacity={0.55} filter="url(#cmp-glow)" />
                        <path d={d} fill={`url(#cmp-fill-${s.id.replace(/[^a-z0-9]/gi, '')})`} stroke={s.color} strokeWidth={1.75} />
                    </g>
                )
            })}
            {axes.map((f, i) => {
                if (!showLabel(i)) return null
                const a = angle(i) - Math.PI / 2
                const r = R + (compact ? 8 : 12)
                const x = Math.cos(a) * r
                const y = Math.sin(a) * r
                const anchor = Math.abs(Math.cos(a)) < 0.2 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end'
                return (
                    <text key={f} x={x} y={y} dy="0.35em" textAnchor={anchor} fontSize={compact ? 9.5 : 11.5} fill={FEATURES[f].color} opacity={0.92}>
                        {FEATURES[f].label}
                    </text>
                )
            })}
        </svg>
    )
}
