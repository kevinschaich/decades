// oklch() strings from theme.ts → sRGB 0..1 triples for WebGL attributes (three's Color can't parse oklch).
export function oklchToRgb(css: string): [number, number, number] {
    const m = css.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
    if (!m) return [1, 1, 1]
    const L = +m[1], C = +m[2], h = (+m[3] * Math.PI) / 180
    const a = C * Math.cos(h), b = C * Math.sin(h)
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
    const lin = [
        4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
    ]
    return lin.map((c) => {
        c = Math.max(0, Math.min(1, c))
        return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
    }) as [number, number, number]
}
