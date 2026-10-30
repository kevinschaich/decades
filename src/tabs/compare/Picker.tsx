// A searchable chip for one subject: tap it, type a decade, year, artist or genre, pick.
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, Popover, PopoverContent, PopoverTrigger } from '@kevinschaich/components'
import { ChevronDown, Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Genre } from '../../data'
import { GENRE_LABELS } from '../../theme'
import { kindLabel, subjectLabel, type Kind, type Subject } from './model'

type Catalog = { decades: number[]; years: number[]; artists: string[]; genres: string[] }

type Props = {
    catalog: Catalog
    value: Subject | null // null renders an "Add" chip
    color?: string
    onPick: (s: Subject) => void
    onRemove?: () => void
}

export function Picker({ catalog, value, color, onPick, onRemove }: Props) {
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState('')
    const groups = useMemo(() => {
        const needle = q.trim().toLowerCase()
        const has = (s: string) => !needle || s.toLowerCase().includes(needle)
        const decades = catalog.decades.filter((d) => has(`${d}s`) || has(`${String(d).slice(2)}s`)).map((d) => String(d))
        const years = needle ? catalog.years.map(String).filter((y) => y.includes(needle)).slice(0, 12) : []
        const genres = catalog.genres.filter((g) => has(GENRE_LABELS[g as Genre] ?? g) || has(g))
        const artists = catalog.artists.filter(has).slice(0, needle ? 40 : 15)
        return [
            ['decade', decades],
            ['year', years],
            ['genre', genres],
            ['artist', artists],
        ] as [Kind, string[]][]
    }, [catalog, q])

    const pick = (s: Subject) => {
        onPick(s)
        setOpen(false)
        setQ('')
    }

    return (
        <div className="inline-flex items-center">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card/60 px-3 text-sm font-medium backdrop-blur transition-colors hover:bg-accent"
                    style={value && color ? { borderColor: color, boxShadow: `0 0 18px -6px ${color}` } : undefined}
                >
                    {value ? (
                        <>
                            <span className="size-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                            <span className="max-w-[9.5rem] truncate">{subjectLabel(value)}</span>
                            <ChevronDown className="size-3.5 opacity-60" />
                        </>
                    ) : (
                        <>
                            <Plus className="size-3.5" />
                            <span>Add</span>
                        </>
                    )}
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                    <Command shouldFilter={false}>
                        <CommandInput autoFocus placeholder="A decade, year, artist or genre" value={q} onValueChange={setQ} />
                        <CommandList className="max-h-72">
                            <CommandEmpty>Nothing matches.</CommandEmpty>
                            {groups.map(([kind, items]) =>
                                items.length ? (
                                    <CommandGroup key={kind} heading={kindLabel[kind] + 's'}>
                                        {items.map((key) => (
                                            <CommandItem key={key} value={`${kind}:${key}`} onSelect={() => pick({ kind, key })}>
                                                {subjectLabel({ kind, key })}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                ) : null,
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {onRemove && (
                <button aria-label={`Remove ${value ? subjectLabel(value) : ''}`} onClick={onRemove} className="-ml-1 rounded-full p-1.5 text-muted-foreground hover:text-foreground">
                    <X className="size-3.5" />
                </button>
            )}
        </div>
    )
}
