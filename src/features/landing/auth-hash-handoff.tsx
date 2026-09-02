"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { createAcornBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser"

// Links sent from the auth dashboard, and any link built from the project's
// site URL, arrive at the landing with the session in the URL hash instead of
// at the callback. Nothing server-side can see a hash, so this picks it up,
// lets the client store the session, then moves on to the right page.
export const AuthHashHandoff = () => {
  const router = useRouter()

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    const query = new URLSearchParams(window.location.search)
    const errorCode = hash.get("error_code") ?? query.get("error_code") ?? hash.get("error") ?? query.get("error")
    if (errorCode) {
      router.replace("/forgot-password?expired=1")
      return
    }
    if (!hash.get("access_token") || !isSupabaseConfigured()) return
    const destination = hash.get("type") === "recovery" ? "/reset-password" : "/app"
    const client = createAcornBrowserClient()
    const { data: subscription } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY" || event === "INITIAL_SESSION") {
        subscription.subscription.unsubscribe()
        router.replace(destination)
        router.refresh()
      }
    })
    return () => subscription.subscription.unsubscribe()
  }, [router])

  return null
}
