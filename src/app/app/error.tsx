"use client"

import { useEffect } from "react"

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return <main className="workspace-error">
    <span>!</span>
    <p className="eyebrow">Workspace unavailable</p>
    <h1>Something interrupted this page.</h1>
    <p>Your last verified workspace state is still stored. Try loading the page again.</p>
    <button className="primary-button" type="button" onClick={reset}>Try again</button>
  </main>
}
