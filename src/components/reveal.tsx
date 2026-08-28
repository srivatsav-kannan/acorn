"use client"

import { useEffect, useRef, type ReactNode } from "react"

// Scroll reveal for the public pages: one gentle rise, once, and never for
// readers who asked the OS for reduced motion (the CSS handles that half).
export const Reveal = ({ children, className = "" }: { children: ReactNode, className?: string }) => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node || !("IntersectionObserver" in window)) {
      node?.classList.add("is-visible")
      return
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible")
          observer.unobserve(entry.target)
        }
      }
    }, { rootMargin: "0px 0px -8% 0px" })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref} className={`reveal ${className}`}>{children}</div>
}
