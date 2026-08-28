import type { Metadata } from "next"
import { Inter, Newsreader } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" })
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-serif", style: ["normal", "italic"], display: "swap" })

export const metadata: Metadata = {
  title: "CourseContext",
  description: "An academic planning workspace that you and your agent share"
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${newsreader.variable}`}><body>{children}</body></html>
}
