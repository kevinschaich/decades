import { useEffect, useRef, useState } from 'react'

const ease = (t: number) => 1 - Math.pow(1 - t, 3)

/** Smoothly morphs keyed number arrays toward their targets. New keys grow from zero; arrays of a new length start at zero. */
export function useTween(target: Record<string, number[]>, ms = 750): Record<string, number[]> {
    const [shown, setShown] = useState(target)
    const current = useRef(target)
    useEffect(() => {
        const from: Record<string, number[]> = {}
        for (const k in target) {
            const prev = current.current[k]
            from[k] = prev && prev.length === target[k].length ? prev : target[k].map(() => 0)
        }
        const start = performance.now()
        let raf = 0
        const step = (now: number) => {
            const t = ease(Math.min(1, (now - start) / ms))
            const next: Record<string, number[]> = {}
            for (const k in target) next[k] = target[k].map((v, i) => from[k][i] + (v - from[k][i]) * t)
            current.current = next
            setShown(next)
            if (t < 1) raf = requestAnimationFrame(step)
        }
        raf = requestAnimationFrame(step)
        return () => cancelAnimationFrame(raf)
    }, [target, ms])
    return shown
}
