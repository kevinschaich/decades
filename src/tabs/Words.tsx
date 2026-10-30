// Words: are songs getting simpler? Every song plotted by year for one lyric measure at a time, with notable songs
// you can open, plus how "I" took over from "you".
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, ToggleGroup, ToggleGroupItem } from '@kevinschaich/components'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import type { Data, Song } from '../data'
import { DECADE_COLORS, DECADES, TYPE } from '../theme'
import { METRIC_DEFS, finding, outliers, points, pronounFinding, pronounSeries, verdict, type MetricId } from './words/model'
import { Pronouns } from './words/Pronouns'
import { Swarm } from './words/Swarm'

export function Words({ data }: { data: Data }) {
    const songs = useMemo(() => points(data), [data])
    const [metric, setMetric] = useState<MetricId>('variety')
    const [selected, setSelected] = useState<Song | null>(null)
    const def = METRIC_DEFS.find((d) => d.id === metric)!
    const headline = useMemo(() => verdict(songs), [songs])
    const text = useMemo(() => finding(songs, def), [songs, def])
    const notable = useMemo(() => outliers(songs, def), [songs, def])
    const series = useMemo(() => pronounSeries(songs), [songs])
    const pron = useMemo(() => pronounFinding(series), [series])

    return (
        <div className="h-full overflow-y-auto">
            <section className="flex min-h-[640px] flex-col gap-3 px-4 pt-2 pb-6 sm:h-full sm:px-8">
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-3xl">
                    <p className={TYPE.label}>Are songs getting simpler?</p>
                    <p className={`${TYPE.body} mt-1`}>
                        <span className="font-semibold text-foreground">{headline.answer}</span> {headline.detail}
                    </p>
                </motion.div>

                <div className="-mx-4 shrink-0 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
                    <ToggleGroup value={[metric]} onValueChange={(v: string[]) => { if (v[0]) { setMetric(v[0] as MetricId); setSelected(null) } }} variant="outline" size="sm">
                        {METRIC_DEFS.map((d) => <ToggleGroupItem key={d.id} value={d.id} className="whitespace-nowrap">{d.label}</ToggleGroupItem>)}
                    </ToggleGroup>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div key={metric} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="max-w-3xl">
                        <p className="text-sm text-foreground/90">{text}</p>
                        <p className={`${TYPE.annotation} mt-0.5`}>{def.blurb} Each dot is a song in the year it first charted; the bright line is the {def.stat === 'mean' ? 'average' : 'typical (median) song'}, the haze the middle half.</p>
                    </motion.div>
                </AnimatePresence>

                <div className="relative min-h-[360px] flex-1">
                    <Swarm songs={songs} def={def} selected={selected} onSelect={setSelected} />
                    <AnimatePresence>
                        {selected && (
                            <motion.div
                                key={selected.id}
                                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
                                className="absolute right-2 bottom-8 left-2 z-20 sm:left-auto sm:w-96"
                            >
                                <Card size="sm" glass>
                                    <CardHeader>
                                        <CardTitle className="flex items-start justify-between gap-2">
                                            <span>{selected.title}</span>
                                            <Button size="sm" variant="ghost" className="-mt-1 -mr-2 h-7 px-2" onClick={() => setSelected(null)} aria-label="Close">✕</Button>
                                        </CardTitle>
                                        <CardDescription>
                                            {selected.artist} · {selected.year} · best #{selected.bestRank}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {selected.analysis?.summary && <p className="text-sm leading-relaxed">{selected.analysis.summary}</p>}
                                        <p className="font-mono text-xs tabular-nums text-muted-foreground">
                                            {def.label}: <span className="text-foreground">{def.fmt(def.get(selected) ?? 0)}</span>
                                        </p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {DECADES.map((d) => (
                            <span key={d} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span className="size-2 rounded-full" style={{ background: DECADE_COLORS[d] }} />{String(d).slice(2)}s
                            </span>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {notable.map((o) => (
                            <Button key={`${o.high ? "hi" : "lo"}-${o.song.id}`} size="sm" variant={selected === o.song ? 'secondary' : 'ghost'} className="h-7 px-2 text-xs" onClick={() => setSelected(o.song)}>
                                <span className="text-muted-foreground">{o.high ? def.hi : def.lo}:</span> {o.song.title}
                            </Button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="border-t border-border/50 px-4 py-8 sm:px-8">
                <div className="max-w-3xl">
                    <p className={TYPE.label}>The rise of “I”</p>
                    <h2 className={`${TYPE.heading} mt-1`}>Who the songs are about</h2>
                    <p className={`${TYPE.body} mt-2`}>{pron}</p>
                    <p className={`${TYPE.annotation} mt-1`}>Each line is that pronoun’s share of all the I, you, we and they in a year’s songs.</p>
                </div>
                <div className="mt-6">
                    <Pronouns series={series} />
                </div>
            </section>
        </div>
    )
}
