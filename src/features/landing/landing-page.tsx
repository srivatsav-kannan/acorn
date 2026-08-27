import Link from "next/link"

export const LandingPage = () => <main className="public-page">
  <header className="public-header"><Link className="wordmark" href="/"><span className="wordmark-mark">C</span><span>CourseContext</span></Link><nav aria-label="Public"><a href="#how">How it works</a><a href="/login">Sign in</a></nav></header>
  <section className="hero">
    <div className="hero-copy"><p className="eyebrow">A shared academic workspace</p><h1>Your academic workspace, understood by both you and your agent.</h1><p className="hero-lead">Plan a quarter, track degree progress, collect useful context, and let an agent act on the same structured information you see.</p><div className="hero-actions"><a className="primary-button" href="/demo">Try the demo</a><a className="secondary-button" href="/login">Create a workspace</a></div><p className="trust-note">No Stanford login required. The demo resets automatically.</p></div>
    <div className="hero-product" aria-label="CourseContext product preview">
      <div className="preview-bar"><span className="wordmark-mark">C</span><b>Autumn plan</b><span>14 units</span></div>
      <div className="preview-body"><div className="preview-list"><p>Primary scenario</p><div><i className="course-color red" /><span><b>CS 106B</b><small>Programming Abstractions</small></span><em>5</em></div><div><i className="course-color blue" /><span><b>MATH 51</b><small>Linear Algebra</small></span><em>4</em></div><div><i className="course-color gold" /><span><b>DESIGN 60</b><small>Design Foundations</small></span><em>2</em></div></div><div className="preview-calendar"><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><div className="preview-event event-one">CS 106B</div><div className="preview-event event-two">MATH 51</div><div className="preview-event event-three">DESIGN 60</div></div></div>
      <div className="preview-agent"><span>✓</span><p><b>Plan check complete</b><small>No hard conflicts. Friday remains open.</small></p></div>
    </div>
  </section>
  <section id="how" className="principles"><article><span>01</span><h2>Context that lasts</h2><p>Preferences, sources, ideas, and decisions live in one inspectable workspace instead of disappearing inside a chat.</p></article><article><span>02</span><h2>One action model</h2><p>Every human click and agent edit uses the same semantic command, validation, receipt, and undo path.</p></article><article><span>03</span><h2>Research with provenance</h2><p>The agent searches what you already know first, labels information gaps, and saves useful findings with their sources.</p></article></section>
  <footer className="public-footer"><span>Built for the WebMCP Challenge</span><span>Not an official Stanford University product.</span></footer>
</main>
