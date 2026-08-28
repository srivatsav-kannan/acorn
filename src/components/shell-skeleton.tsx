export const ShellSkeleton = () => <div className="app-frame skeleton-frame" aria-hidden="true">
  <header className="topbar">
    <span className="skeleton-block skeleton-mark" />
    <div className="skeleton-tabs">
      {[0, 1, 2, 3].map((tab) => <span key={tab} className="skeleton-block skeleton-tab" />)}
    </div>
    <div className="topbar-actions"><span className="skeleton-block skeleton-pill" /><span className="skeleton-block skeleton-round" /></div>
  </header>
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
