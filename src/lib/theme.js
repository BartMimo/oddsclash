// Licht/donker-thema — losse overrides in index.css (".light"-klasse op
// <html>) i.p.v. Tailwind's dark:-variant, zodat componenten ongemoeid
// blijven. Hier alleen het lezen/schrijven van de voorkeur.
const KEY = 'oc_theme'

export function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark'
  return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle('light', theme === 'light')
  localStorage.setItem(KEY, theme)
}
