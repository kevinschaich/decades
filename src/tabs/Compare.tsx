// Compare: two or three decades, years, artists or genres side by side. Their fingerprints overlap on one radar,
// the biggest differences are spelled out, the songs that embody each are listed, and the galaxy shows where each
// one lives. The selection lives in the URL hash (#compare/decade:1960/artist:Taylor%20Swift) so it can be shared.
import { Badge, Button, Card, ToggleGroup, ToggleGroupItem } from '@kevinschaich/components'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Data, Song } from '../data'
import { INK, THEME_COLORS, THEME_LABELS, TYPE } from '../theme'
import { GalaxyMap } from './compare/GalaxyMap'
import { buildModel, catalog as buildCatalog, characteristic, FACETS, profile, RADAR, SUBJECT_COLORS, subjectId, subjectLabel, traits, type Facet, type Subject } from './compare/model'
import { Picker } from './compare/Picker'
import { Radar } from './compare/Radar'

const DEFAULT: Subject[] = [{ kind: 'decade', key: '1960' }, { kind: 'decade', key: '2010' }]
const PRESETS: { label: string; subjects: Subject[] }[] = [
    { label: 'Elvis vs Taylor Swift', subjects: [{ kind: 'artist', key: 'Elvis Presley' }, { kind: 'artist', key: 'Taylor Swift' }] },
    { label: 'The Beatles vs Drake', subjects: [{ kind: 'artist', key: 'The Beatles' }, { kind: 'artist', key: 'Drake' }] },
    { label: 'Country vs Hip-hop', subjects: [{ kind: 'genre', key: 'country' }, { kind: 'genre', key: 'hip-hop/rnb' }] },
    { label: '50s, 80s, 2020s', subjects: [{ kind: 'decade', key: '1950' }, { kind: 'decade', key: '1980' }, { kind: 'decade', key: '2020' }] },
]

const KINDS = new Set(['decade', 'year', 'artist', 'genre'])
function fromHash(): Subject[] | null {
    const parts = location.hash.replace(/^#\/?/, '').split('/')
    if (parts[0] !== 'compare') return null
    const out = parts.slice(1).flatMap((p) => {
        const i = p.indexOf(':')
        const kind = p.slice(0, i)
        return i > 0 && KINDS.has(kind) ? [{ kind, key: decodeURIComponent(p.slice(i + 1)) } as Subject] : []
    })
    return out.length >= 2 ? out.slice(0, 3) : null
}
const toHash = (s: Subject[]) => `#compare/${s.map((x) => `${x.kind}:${encodeURIComponent(x.key)}`).join('/')}`

function useWidth<T extends HTMLElement>() {
    const ref = useRef<T>(null)
    const [w, setW] = useState(0)
    useEffect(() => {
        const el = ref.current
        if (!el) return
        const ro = new ResizeObserver(() => setW(el.clientWidth))
        ro.observe(el)
        return () => ro.disconnect()
    }, [])
    return [ref, w] as const
}

export function Compare({ data }: { data: Data }) {
    const model = useMemo(() => buildModel(data), [data])
    const catalog = useMemo(() => buildCatalog(model, data), [model, data])
    const [subjects, setSubjects] = useState<Subject[]>(() => fromHash() ?? DEFAULT)
    const [facet, setFacet] = useState<Facet>('Themes')
    const [hover, setHover] = useState<Song | null>(null)
    const [open, setOpen] = useState<Song | null>(null)
    const [radarRef, radarW] = useWidth<HTMLDivElement>()

    useEffect(() => {
        history.replaceState(null, '', toHash(subjects))
    }, [subjects])
    useEffect(() => {
        const on = () => {
            const s = fromHash()
            if (s) setSubjects(s)
        }
        window.addEventListener('hashchange', on)
        return () => window.removeEventListener('hashchange', on)
    }, [])

    const profiles = useMemo(() => subjects.map((s) => profile(model, s)).filter((p) => p.songs.length), [model, subjects])
    const colorOf = (s: Subject) => SUBJECT_COLORS[subjects.findIndex((x) => subjectId(x) === subjectId(s))] ?? INK.text

    const axes = RADAR[facet]
    const series = useMemo(() => profiles.map((p) => ({ id: subjectId(p.subject), color: colorOf(p.subject), values: axes.map((f) => p.mean[f]) })), [profiles, axes]) // eslint-disable-line react-hooks/exhaustive-deps
    const average = useMemo(() => axes.map((f) => model.mean[f]), [axes, model])
    const groups = useMemo(
        () => profiles.map((p) => ({ id: subjectId(p.subject), color: colorOf(p.subject), label: subjectLabel(p.subject), songs: p.songs, centroid: p.centroid })),
        [profiles], // eslint-disable-line react-hooks/exhaustive-deps
    )
    const distinct = useMemo(() => profiles.map((_, i) => ({ traits: traits(model, profiles, i), songs: characteristic(model, profiles, i) })), [model, profiles])

    const set = (i: number, s: Subject) =>
        setSubjects((cur) => {
            if (cur.some((x, j) => j !== i && subjectId(x) === subjectId(s))) return cur
            return i >= cur.length ? [...cur, s] : cur.map((x, j) => (j === i ? s : x))
        })
    const remove = (i: number) => setSubjects((cur) => cur.filter((_, j) => j !== i))

    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pt-2 pb-10 sm:px-8">
                <section className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                        {subjects.map((s, i) => (
                            <span key={i} className="inline-flex items-center gap-2">
                                {i > 0 && <span className={`${TYPE.label} px-1`}>vs</span>}
                                <Picker catalog={catalog} value={s} color={SUBJECT_COLORS[i]} onPick={(x) => set(i, x)} onRemove={subjects.length > 2 ? () => remove(i) : undefined} />
                            </span>
                        ))}
                        {subjects.length < 3 && <Picker catalog={catalog} value={null} onPick={(x) => set(subjects.length, x)} />}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                        <span className={`${TYPE.label} mr-1`}>Try</span>
                        {PRESETS.map((p) => (
                            <Button key={p.label} size="sm" variant="ghost" className="h-7 rounded-full px-2.5 text-xs text-muted-foreground" onClick={() => setSubjects(p.subjects)}>
                                {p.label}
                            </Button>
                        ))}
                    </div>
                </section>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                    <Card className="relative gap-2 overflow-hidden p-3 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 className={TYPE.heading}>Fingerprint</h2>
                            <ToggleGroup value={[facet]} onValueChange={(v: unknown[]) => v[0] && setFacet(v[0] as Facet)} size="sm" variant="outline">
                                {FACETS.map((f) => (
                                    <ToggleGroupItem key={f} value={f} className="px-2.5 text-xs">
                                        {f}
                                    </ToggleGroupItem>
                                ))}
                            </ToggleGroup>
                        </div>
                        <div ref={radarRef} className="flex w-full justify-center">
                            {radarW > 0 && <Radar size={Math.min(620, radarW)} axes={axes} series={series} average={average} facet={facet} />}
                        </div>
                        <p className={`${TYPE.annotation} text-center`}>The dashed line is every chart since 1950.</p>
                    </Card>

                    <div className="flex flex-col gap-5">
                        <Card className="gap-4 p-4 sm:p-5">
                            <h2 className={TYPE.heading}>What sets each apart</h2>
                            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, profiles.length)}, minmax(0, 1fr))` }}>
                                {profiles.map((p, i) => (
                                    <div key={subjectId(p.subject)} className="min-w-0">
                                        <div className="mb-2 truncate font-heading text-sm font-semibold" style={{ color: colorOf(p.subject) }}>
                                            {subjectLabel(p.subject)}
                                        </div>
                                        <ul className="flex flex-col gap-2.5">
                                            {distinct[i].traits.map((t) => (
                                                <li key={t.feature} className="text-xs leading-snug sm:text-sm">
                                                    <div className="mb-1 h-1 overflow-hidden rounded-full bg-white/5">
                                                        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, t.strength * 70)}%`, background: colorOf(p.subject) }} />
                                                    </div>
                                                    <span className="block first-letter:uppercase">{t.text}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </Card>
                        <Card className="gap-2 p-4 sm:p-5">
                            <h2 className={TYPE.heading}>In the galaxy</h2>
                            <p className={TYPE.annotation}>Every song, placed by what it’s about. Similar songs sit together.</p>
                            <div className="aspect-[4/3] w-full overflow-hidden rounded-lg" style={{ background: INK.bg }}>
                                <GalaxyMap all={model.songs} groups={groups} highlight={hover ?? open} />
                            </div>
                        </Card>
                    </div>
                </div>

                <section className="flex flex-col gap-3">
                    <h2 className={TYPE.heading}>Songs that sum each up</h2>
                    <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]">
                        {profiles.map((p, i) => (
                            <Card key={subjectId(p.subject)} className="gap-1 p-3 sm:p-4" style={{ borderTop: `2px solid ${colorOf(p.subject)}` }}>
                                <div className="mb-1 px-2 font-heading text-sm font-semibold" style={{ color: colorOf(p.subject) }}>
                                    {subjectLabel(p.subject)}
                                </div>
                                {distinct[i].songs.map((s) => {
                                    const t = s.analysis?.primaryTheme
                                    const isOpen = open === s
                                    return (
                                        <button
                                            key={s.id}
                                            onMouseEnter={() => setHover(s)}
                                            onMouseLeave={() => setHover(null)}
                                            onClick={() => setOpen(isOpen ? null : s)}
                                            className="flex flex-col gap-1 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/5"
                                        >
                                            <span className="flex w-full items-baseline justify-between gap-2">
                                                <span className="min-w-0 truncate text-sm font-medium">{s.title}</span>
                                                <span className={`${TYPE.number} shrink-0 text-xs text-muted-foreground`}>{s.year}</span>
                                            </span>
                                            <span className="flex w-full items-center gap-2">
                                                <span className="min-w-0 truncate text-xs text-muted-foreground">{s.artist}</span>
                                                {t && (
                                                    <Badge variant="outline" className="h-4 shrink-0 px-1.5 text-[10px]" style={{ color: THEME_COLORS[t], borderColor: THEME_COLORS[t] }}>
                                                        {THEME_LABELS[t]}
                                                    </Badge>
                                                )}
                                            </span>
                                            {isOpen && s.analysis?.summary && <span className="text-xs leading-relaxed text-foreground/80">{s.analysis.summary}</span>}
                                        </button>
                                    )
                                })}
                            </Card>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    )
}
