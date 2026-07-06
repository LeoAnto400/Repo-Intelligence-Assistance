export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={`${className} animate-spin text-slate-600 dark:text-slate-300`}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="4" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export default Spinner
