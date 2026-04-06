import { cn } from '@/lib/utils'

interface MarkupToolIconBlockProps {
  className?: string
}

export default function MarkupToolIconBlock({ className }: MarkupToolIconBlockProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width="20"
      height="20"
      fill="none"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
      className={cn('block h-5 w-5 shrink-0', className)}
    >
      <circle cx="32" cy="32" r="30" fill="#EA8D2D" />
      <path
        d="M22 45 31.4 20.2c.3-.9 1.6-.9 1.9 0L42 45"
        stroke="#fff"
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M25.6 37.2h12.8"
        stroke="#fff"
        strokeWidth="4.4"
        strokeLinecap="round"
      />
      <path
        d="M27.8 30.7 22.9 43h18.2l-4.9-12.3"
        stroke="#fff"
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
