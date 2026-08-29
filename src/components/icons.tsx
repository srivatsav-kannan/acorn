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

export const HomeIcon = (props: SVGProps<SVGSVGElement>) => <svg {...base(props)}><path d="M4 10.5 12 4l8 6.5" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></svg>

export const PlanIcon = (props: SVGProps<SVGSVGElement>) => <svg {...base(props)}><rect x="4" y="5" width="16" height="15" rx="1.5" /><path d="M4 10h16" /><path d="M8 3v4M16 3v4" /><path d="M8 14h3M8 17h5" /></svg>

export const ExploreIcon = (props: SVGProps<SVGSVGElement>) => <svg {...base(props)}><path d="M12 20V7c0-1.5 1.8-3 6-3v13c-4.2 0-6 1.5-6 3Z" /><path d="M12 20V7c0-1.5-1.8-3-6-3v13c4.2 0 6 1.5 6 3Z" /></svg>

export const LibraryIcon = (props: SVGProps<SVGSVGElement>) => <svg {...base(props)}><path d="M5 4h3v16H5zM10.5 4h3v16h-3z" /><path d="m16.5 5 3.2 15 2.3-.5-3.2-15z" transform="scale(0.92) translate(0.5 0.5)" /></svg>

export const ProgramsIcon = (props: SVGProps<SVGSVGElement>) => <svg {...base(props)}><path d="M12 4 3 8.5 12 13l9-4.5L12 4Z" /><path d="M6.5 10.8V16c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-5.2" /><path d="M21 9v5" /></svg>

export const TogetherIcon = (props: SVGProps<SVGSVGElement>) => <svg {...base(props)}><circle cx="9" cy="12" r="5.5" /><circle cx="15" cy="12" r="5.5" /></svg>

export const ProfileIcon = (props: SVGProps<SVGSVGElement>) => <svg {...base(props)}><circle cx="12" cy="8.5" r="3.8" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></svg>

export const SearchIcon = (props: SVGProps<SVGSVGElement>) => <svg {...base(props)}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>

export const ActivityIcon = (props: SVGProps<SVGSVGElement>) => <svg {...base(props)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2.5" /></svg>

export const SettingsIcon = (props: SVGProps<SVGSVGElement>) => <svg {...base(props)}><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="15.5" cy="7" r="2" /><circle cx="7.5" cy="17" r="2" /></svg>

export const PlusIcon = (props: SVGProps<SVGSVGElement>) => <svg {...base(props)}><path d="M12 5v14M5 12h14" /></svg>

export const CloseIcon = (props: SVGProps<SVGSVGElement>) => <svg {...base(props)}><path d="m6 6 12 12M18 6 6 18" /></svg>

export const ExternalIcon = (props: SVGProps<SVGSVGElement>) => <svg {...base(props)}><path d="M9 5H5v14h14v-4" /><path d="M13 4h7v7" /><path d="M20 4 11 13" /></svg>

export const CheckIcon = (props: SVGProps<SVGSVGElement>) => <svg {...base(props)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>

export const WarnIcon = (props: SVGProps<SVGSVGElement>) => <svg {...base(props)}><path d="M12 4 2.8 20h18.4L12 4Z" /><path d="M12 10.5v4M12 17.4v.1" /></svg>

export const InfoIcon = (props: SVGProps<SVGSVGElement>) => <svg {...base(props)}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 7.6v.1" /></svg>

export const UndoIcon = (props: SVGProps<SVGSVGElement>) => <svg {...base(props)}><path d="M8 6 4 10l4 4" /><path d="M4 10h10a6 6 0 1 1 0 12h-3" transform="translate(0 -2)" /></svg>

export const ArrowIcon = (props: SVGProps<SVGSVGElement>) => <svg {...base(props)}><path d="M4 12h16" /><path d="m13 5 7 7-7 7" /></svg>

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

export const HomeFill = (props: SVGProps<SVGSVGElement>) => <svg {...fill(props)}><path d="M12 3.2 3.2 10.4V20.5h6.2v-5.3h5.2v5.3h6.2V10.4Z" /></svg>

export const PlanFill = (props: SVGProps<SVGSVGElement>) => <svg {...fill(props)}><path fillRule="evenodd" d="M4 5h16v15.5H4Zm2.2 6.2h11.6v7H6.2Z" /><path d="M7 2.8h2.2v3.4H7Zm7.8 0H17v3.4h-2.2Z" /></svg>

export const ExploreFill = (props: SVGProps<SVGSVGElement>) => <svg {...fill(props)}><path d="M11.2 6.1C9.8 4.9 7.6 4.2 4.5 4.2v13.6c3.1 0 5.3.7 6.7 1.9Zm1.6 0v13.6c1.4-1.2 3.6-1.9 6.7-1.9V4.2c-3.1 0-5.3.7-6.7 1.9Z" /></svg>

export const LibraryFill = (props: SVGProps<SVGSVGElement>) => <svg {...fill(props)}><path d="M4 3.8h3.2v16.4H4Zm5.4 0h3.2v16.4H9.4Zm6-.1 3 .6-.4 16.1-3-.6Z" /></svg>

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
