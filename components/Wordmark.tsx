/**
 * The Red Jitsu brand wordmark — type IS the brand (Nike-style).
 * Heavy, tight, italic, uppercase. "RED" in brand red, "JITSU" in white.
 * Scales perfectly at any size; replaces the detailed skull logo in the UI.
 */
export default function Wordmark({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const sizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-5xl sm:text-6xl',
  }
  return (
    <span
      className={`font-black uppercase italic tracking-tight leading-none select-none whitespace-nowrap ${sizes[size]} ${className}`}
    >
      <span className="text-brand-red">Red</span>
      <span className="text-white">&nbsp;Jitsu</span>
    </span>
  )
}
