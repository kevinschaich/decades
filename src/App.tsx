import { Byline, DataSources, Tabs, TabsList, TabsTrigger, type DataSource } from '@kevinschaich/components'
import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react'
import { useData, type Data } from './data'
import { ErrorState, Failed, Loader } from './status'
import { TYPE } from './theme'

export const NAME = 'Decades'
export const TAGLINE = 'The story of us, told through the songs we loved most'
export const REPO = 'kevinschaich/decades'

const TABS: { id: string; label: string; Component: ComponentType<{ data: Data }> }[] = [
    { id: 'story', label: 'Story', Component: lazy(() => import('./tabs/Story').then((m) => ({ default: m.Story }))) },
    { id: 'themes', label: 'Themes', Component: lazy(() => import('./tabs/Themes').then((m) => ({ default: m.Themes }))) },
    { id: 'galaxy', label: 'Galaxy', Component: lazy(() => import('./tabs/Galaxy').then((m) => ({ default: m.Galaxy }))) },
    { id: 'words', label: 'Words', Component: lazy(() => import('./tabs/Words').then((m) => ({ default: m.Words }))) },
    { id: 'compare', label: 'Compare', Component: lazy(() => import('./tabs/Compare').then((m) => ({ default: m.Compare }))) },
]

const SOURCES: DataSource[] = [
    { what: 'Year-end charts', from: 'Billboard, via Wikipedia', href: 'https://en.wikipedia.org/wiki/Billboard_Year-End_Hot_100_singles_of_2025', license: 'CC BY-SA 4.0' },
    { what: 'This year’s chart', from: 'Billboard Hot 100', href: 'https://www.billboard.com/charts/hot-100/', license: 'Chart positions for reference' },
    { what: 'Lyrics, read but never shown', from: 'LRCLIB', href: 'https://lrclib.net', license: 'Lyrics belong to their rights holders' },
    { what: 'Artists, genres and tags', from: 'MusicBrainz', href: 'https://musicbrainz.org', license: 'CC0' },
    { what: 'Themes, moods and summaries', from: 'Analysis by Claude', href: 'https://www.anthropic.com/claude', license: 'Generated for this project' },
    { what: 'Profanity word list', from: 'LDNOOBW', href: 'https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words', license: 'CC BY 4.0' },
    { what: 'Pronunciations for rhymes', from: 'CMU Pronouncing Dictionary', href: 'http://www.speech.cs.cmu.edu/cgi-bin/cmudict', license: 'BSD-style' },
    { what: 'The original 2015 project and genre groups', from: 'Juhee Lee, Yinan Wen and Kevin Schaich', href: 'https://github.com/kevinschaich/decades/tree/main/legacy', license: 'MIT' },
]

const tabFromHash = () => {
    const id = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]
    return TABS.some((t) => t.id === id) ? id : TABS[0].id
}

export function App() {
    const data = useData()
    const [tab, setTab] = useState(tabFromHash)

    useEffect(() => {
        const onHash = () => setTab(tabFromHash())
        window.addEventListener('hashchange', onHash)
        return () => window.removeEventListener('hashchange', onHash)
    }, [])

    const select = (id: string) => {
        setTab(id)
        history.replaceState(null, '', `#${id}`)
    }

    const Active = TABS.find((t) => t.id === tab)!.Component

    return (
        <div className="flex h-dvh flex-col bg-background text-foreground">
            <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 pt-4 pb-3 sm:px-8 sm:pt-6">
                <div className="min-w-0">
                    <h1 className={TYPE.title}>{NAME}</h1>
                    <p className="text-sm text-muted-foreground">{TAGLINE}</p>
                </div>
                <div className="flex max-w-full items-center gap-2 overflow-x-auto [scrollbar-width:none]">
                    <Tabs value={tab} onValueChange={(v) => select(String(v))}>
                        <TabsList>
                            {TABS.map((t) => (
                                <TabsTrigger key={t.id} value={t.id}>
                                    {t.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    <DataSources sources={SOURCES} />
                </div>
            </header>
            <main className="relative min-h-0 flex-1">
                <ErrorState key={tab}>
                    {data instanceof Error ? (
                        <Failed />
                    ) : data ? (
                        <Suspense fallback={<Loader />}>
                            <Active data={data} />
                        </Suspense>
                    ) : (
                        <Loader />
                    )}
                </ErrorState>
            </main>
            <footer className="px-4 py-2 sm:px-8">
                <Byline repo={REPO} />
            </footer>
        </div>
    )
}
