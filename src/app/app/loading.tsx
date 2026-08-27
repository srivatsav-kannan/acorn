export default function Loading() {
  return <main className="workspace-loading" aria-label="Loading workspace" aria-live="polite">
    <span className="workspace-loading-mark">C</span>
    <div><strong>Opening your workspace</strong><small>Loading your plan, Library, and saved context.</small></div>
    <i aria-hidden="true" />
  </main>
}
