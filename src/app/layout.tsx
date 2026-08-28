import type { Metadata } from "next"
import { Instrument_Sans, Source_Serif_4 } from "next/font/google"
import "./globals.css"

const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" })
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", style: ["normal", "italic"], display: "swap" })

export const metadata: Metadata = {
  title: "CourseContext",
  description: "An academic planning workspace that you and your agent share"
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth" className={`${sans.variable} ${serif.variable}`}><body>{children}</body></html>
}
