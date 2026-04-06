import { cn } from '@/lib/utils'

interface MarkupToolIconBlockProps {
  className?: string
}

const MARKUP_TOOL_ICON_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="30" fill="#EA8D2D"/>
    <path d="M22 45 31.4 20.2c.3-.9 1.6-.9 1.9 0L42 45" stroke="#fff" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M25.6 37.2h12.8" stroke="#fff" stroke-width="4.4" stroke-linecap="round"/>
    <path d="M27.8 30.7 22.9 43h18.2l-4.9-12.3" stroke="#fff" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
)}`

export default function MarkupToolIconBlock({ className }: MarkupToolIconBlockProps) {
  return (
    <img
      src={MARKUP_TOOL_ICON_DATA_URI}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn('block h-5 w-5 shrink-0 select-none', className)}
    />
  )
}
