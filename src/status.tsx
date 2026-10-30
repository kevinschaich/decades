// Shared loading and error states for every tab, so they all look the same.
import { Button, Empty, EmptyDescription, EmptyHeader, EmptyTitle, Spinner } from '@kevinschaich/components'
import { Component, type ReactNode } from 'react'

export function Loader() {
    return (
        <div className="flex h-full items-center justify-center" role="status" aria-label="Loading">
            <Spinner className="size-5 text-muted-foreground" />
        </div>
    )
}

export function Failed({ retry }: { retry?: () => void }) {
    return (
        <Empty className="h-full">
            <EmptyHeader>
                <EmptyTitle>This view didn’t load</EmptyTitle>
                <EmptyDescription>Check your connection and try again.</EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" size="sm" onClick={retry ?? (() => location.reload())}>
                Try again
            </Button>
        </Empty>
    )
}

/** Catches a tab that throws (or a chunk that fails to load) and shows a retry instead of a blank page. */
export class ErrorState extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false }
    static getDerivedStateFromError() {
        return { failed: true }
    }
    render() {
        return this.state.failed ? <Failed /> : this.props.children
    }
}
