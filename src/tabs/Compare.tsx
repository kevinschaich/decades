import type { Data } from '../data'
import { TYPE } from '../theme'

// Placeholder: the Compare tab's visualization goes here. See AGENTS.md for the data and helpers.
export function Compare({ data }: { data: Data }) {
    return (
        <div className="flex h-full items-center justify-center p-6 text-center">
            <p className={TYPE.label}>{data.firstYear}–{data.lastYear}</p>
        </div>
    )
}
