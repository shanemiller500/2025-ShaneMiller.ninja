// Lucide has no motorbike, only a push bike. Drawn to match Lucide's 24px / 2px-stroke style.
export default function MotorbikeIcon({ size = 24, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="5" cy="17" r="3" />
    <circle cx="19" cy="17" r="3" />
    <path d="M5 17l3.5-5h6.5l4 5" />
    <path d="M8 12l1.5-2.5h4.5l1 2.5" />
    <path d="M11 17h4l-1-5" />
    <path d="M15 9.5l1-3.5h2.5" />
  </svg>;
}
