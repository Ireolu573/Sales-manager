import type { SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement> & { size?: number }

export default function AgriLedgerLogo({ size = 40, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="AgriLedger logo"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect x="1" y="1" width="46" height="46" rx="13" fill="#0F172A" />
      <path d="M24 34V21" stroke="#4ADE80" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M24 23C13.5 23 10 17.5 10 11C18.5 10.5 25 14.5 24 23Z" fill="#4ADE80" />
      <path d="M24 19C24 11.5 29 7.5 38 8C38 16 33 22 24 23" fill="#16A34A" />
      <path d="M16 36H32" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M18 31H30" stroke="white" strokeWidth="2.8" strokeLinecap="round" opacity=".8" />
    </svg>
  )
}
