"use client"

import { useRouter } from "next/navigation"

export const BackButton = ({ fallback = "/app" }: { fallback?: string }) => {
  const router = useRouter()
  const goBack = () => {
    if (window.history.length > 1) router.back()
    else router.push(fallback)
  }
  return <button className="back-button" type="button" onClick={goBack} aria-label="Back">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.5 5 8 12l6.5 7" /></svg>
    Back
  </button>
}
