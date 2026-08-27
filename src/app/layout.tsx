import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "CourseContext",
  description: "A shared academic workspace for students and agents"
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body>{children}</body></html>
}
