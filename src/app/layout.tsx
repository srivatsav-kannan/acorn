import type { Metadata } from "next"
import { Fraunces, Karla } from "next/font/google"
import "./globals.css"

const karla = Karla({ subsets: ["latin"], variable: "--font-sans", display: "swap" })
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-serif", style: ["normal", "italic"], axes: ["opsz"], display: "swap" })

export const metadata: Metadata = {
  title: "Acorn",
  description: "The Stanford planning workspace you and your agent share"
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth" className={`${karla.variable} ${fraunces.variable}`}><body>{children}</body></html>
}
