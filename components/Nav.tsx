// Legacy navigation — superseded by components/Navigation.tsx (global header,
// bottom tab bar with center action, and SafeAutoRefresh). Several pages still
// render <Nav />, which produced a duplicate top bar (two "RED JITSU" headers).
// Neutralized to a no-op so those pages show only the global nav. Remove the
// remaining <Nav /> usages and delete this file in a later cleanup.
export default function Nav() {
  return null
}
