"use client"

import { useEffect, useRef, useState } from "react"

// Six cards, three visible, drifting one step every few seconds. Scroll-snap
// does the layout work so touch, trackpad, and the arrows all behave, and
// hovering pauses the rotation so nobody has to read against a timer.

const cards: Array<[string, string]> = [
  ["Braindump, get a schedule.", "Tell your agent everything in one go: the classes you're eyeing, the job hours, the club your roommate keeps hyping. It files the mess and hands back a quarter that actually fits."],
  ["Does your agent forget?", "Every new chat starts from zero. Acorn is the memory you both keep, so the plan, the history, and the why are already there when the next conversation starts."],
  ["Have it build the schedule.", "Ask for sections that clear everything: your job, your practice, whatever you've protected. It generates ranked options with the tradeoffs spelled out."],
  ["Context you can actually see.", "Preferences, sources, and open questions live in the workspace where you can read them, so the reasoning behind a choice is still attached a quarter later."],
  ["One command path for both of you.", "Your click and the agent's tool call run the same command, get the same receipt, and undo the same way. Hand over real editing power and reverse anything you don't like."],
  ["If it takes your time, it's on the calendar.", "Classes, club meetings, practice, deadlines, todos. Month or week view, and it exports to your real calendar as .ics."]
]

export const UseCaseCarousel = () => {
  const trackRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  const step = (direction: 1 | -1) => {
    const track = trackRef.current
    if (!track) return
    const card = track.querySelector("article")
    if (!card) return
    const stride = card.getBoundingClientRect().width + 16
    const maxLeft = track.scrollWidth - track.clientWidth
    const next = track.scrollLeft + direction * stride
    if (direction === 1 && track.scrollLeft >= maxLeft - 8) track.scrollTo({ left: 0, behavior: "smooth" })
    else if (direction === -1 && track.scrollLeft <= 8) track.scrollTo({ left: maxLeft, behavior: "smooth" })
    else track.scrollTo({ left: next, behavior: "smooth" })
  }

  useEffect(() => {
    if (paused) return
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = window.setInterval(() => step(1), 5000)
    return () => window.clearInterval(timer)
  }, [paused])

  return <section className="use-band" aria-label="What people use this for" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
    <div className="use-track" ref={trackRef}>
      {cards.map(([title, body]) => <article key={title}>
        <h2>{title}</h2>
        <p>{body}</p>
      </article>)}
    </div>
    <div className="use-arrows">
      <button type="button" aria-label="Previous" onClick={() => step(-1)}>←</button>
      <button type="button" aria-label="Next" onClick={() => step(1)}>→</button>
    </div>
  </section>
}
