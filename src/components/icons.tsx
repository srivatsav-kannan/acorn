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
