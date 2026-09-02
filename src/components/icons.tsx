import type { SVGProps } from "react"

const base = (props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> => ({
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  ...props
})

export const SearchIcon = (props: SVGProps<SVGSVGElement>) => <svg {...base(props)}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>

// Filled glyphs for the mobile navigation. Solid silhouettes read at 19px
// where hairline strokes dissolve.
const fill = (props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> => ({
  width: 19,
  height: 19,
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": true,
  ...props
})

export const PlanFill = (props: SVGProps<SVGSVGElement>) => <svg {...fill(props)}><path fillRule="evenodd" d="M4 5h16v15.5H4Zm2.2 6.2h11.6v7H6.2Z" /><path d="M7 2.8h2.2v3.4H7Zm7.8 0H17v3.4h-2.2Z" /></svg>

export const ExploreFill = (props: SVGProps<SVGSVGElement>) => <svg {...fill(props)}><path d="M11.2 6.1C9.8 4.9 7.6 4.2 4.5 4.2v13.6c3.1 0 5.3.7 6.7 1.9Zm1.6 0v13.6c1.4-1.2 3.6-1.9 6.7-1.9V4.2c-3.1 0-5.3.7-6.7 1.9Z" /></svg>

export const ProgramsFill = (props: SVGProps<SVGSVGElement>) => <svg {...fill(props)}><path d="M12 3.6 1.8 8.4 12 13.2l10.2-4.8Z" /><path d="M6.2 11.7v4.5c0 1.6 2.6 2.9 5.8 2.9s5.8-1.3 5.8-2.9v-4.5L12 14.4Z" /></svg>

export const ProfileFill = (props: SVGProps<SVGSVGElement>) => <svg {...fill(props)}><circle cx="12" cy="8.2" r="4" /><path d="M4.4 20.2c.9-3.8 3.9-5.9 7.6-5.9s6.7 2.1 7.6 5.9Z" /></svg>

export const TogetherFill = (props: SVGProps<SVGSVGElement>) => <svg {...fill(props)}><circle cx="8.6" cy="12" r="5.4" /><circle cx="15.4" cy="12" r="5.4" fill="none" stroke="currentColor" strokeWidth="2" /></svg>

export const NoteFill = (props: SVGProps<SVGSVGElement>) => <svg {...fill(props)}><path d="M4 16.4 14.9 5.5l3.6 3.6L7.6 20H4Z" /><path d="m16.3 4.1 1.2-1.2c.7-.7 1.8-.7 2.5 0l1.1 1.1c.7.7.7 1.8 0 2.5l-1.2 1.2Z" /></svg>

// The acorn. Squirrels plan ahead by stashing these; so does this product.
export const AcornMark = (props: SVGProps<SVGSVGElement>) => <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden="true" {...props}>
  <path d="M11.1 1.6c1.3-.5 2.4.2 2.1 1.3-.2.8-.6 1.4-1.4 1.9l-1.5-.6c.1-1.2.3-2.3.8-2.6Z" fill="var(--acorn-stem, #6b4423)" />
  <path d="M4.3 9.6C4.3 5.9 7.8 3.5 12 3.5s7.7 2.4 7.7 6.1c0 .8-.6 1.4-1.4 1.4H5.7c-.8 0-1.4-.6-1.4-1.4Z" fill="var(--acorn-cap, #6b4423)" />
  <path d="M6 11h12c-.2 5-2.5 8.6-6 10.7C8.5 19.6 6.2 16 6 11Z" fill="var(--acorn-nut, #cf9046)" />
</svg>

// The squirrel-and-acorn mark as a background-free image, so it sits directly
// on any surface, the cardinal topbar included, with no cream box behind it.
export const AcornSquirrelMark = ({ className }: { className?: string }) =>
  // eslint-disable-next-line @next/next/no-img-element
  <img className={className} src="/acorn-squirrel-mark.png" alt="" width={23} height={30} />
