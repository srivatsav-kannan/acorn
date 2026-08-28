export const ShellSkeleton = () => <div className="app-frame skeleton-frame" aria-hidden="true">
  <header className="topbar">
    <span className="skeleton-block skeleton-mark" />
    <span className="skeleton-block skeleton-chip" />
    <div className="topbar-actions"><span className="skeleton-block skeleton-pill" /><span className="skeleton-block skeleton-round" /></div>
  </header>
  <aside className="sidebar">
    <div className="skeleton-nav">
      {[0, 1, 2, 3, 4, 5].map((row) => <span key={row} className="skeleton-block skeleton-nav-row" />)}
    </div>
  </aside>
  <main className="workspace-main">
    <div className="page">
      <span className="skeleton-block skeleton-title" />
      <span className="skeleton-block skeleton-line" />
      <div className="skeleton-grid">
        <span className="skeleton-block skeleton-card" />
        <span className="skeleton-block skeleton-card" />
        <span className="skeleton-block skeleton-card wide" />
      </div>
    </div>
  </main>
</div>
