import { initials, colorFromString } from '../lib/format'

// Gekleurde cirkel-badge met initialen (geen echte logo's).
export default function TeamBadge({ name, size = 'md', color }) {
  const sizes = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-sm',
  }
  const bg = color || colorFromString(name || '')
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold text-white shadow-inner shrink-0 ${sizes[size]}`}
      style={{ backgroundColor: bg }}
      title={name}
    >
      {initials(name)}
    </span>
  )
}
