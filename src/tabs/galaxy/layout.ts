// Galaxy layout + year → world position, shared by the scene and the tab's labels.
export const RADIUS = 34
export const HEIGHT = 26
const Y0 = 1950
const Y1 = 2026

/** The disk is twisted with radius so it reads as spiral arms; time is height. */
export function place(gx: [number, number], year: number, seed = 0.5): [number, number, number] {
    const x = (gx[0] - 0.5) * 2 * RADIUS
    const z = (gx[1] - 0.5) * 2 * RADIUS
    const r = Math.hypot(x, z)
    const t = 0.9 * (r / RADIUS)
    const c = Math.cos(t), s = Math.sin(t)
    const y = ((year + seed - Y0) / (Y1 - Y0) - 0.5) * HEIGHT
    return [x * c - z * s, y, x * s + z * c]
}
export const yearY = (year: number) => place([0.5, 0.5], year, 0)[1]

export const hash = (s: string) => {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    return ((h >>> 0) % 10000) / 10000
}

