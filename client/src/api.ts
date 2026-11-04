const TOKEN_KEY = 'gamenight-token'

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setToken(token: string | null) {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY) } catch { /* private mode */ }
}

const LEGACY_KEY = 'gamenight-show-legacy'

export function getShowLegacy(): boolean {
  try { return localStorage.getItem(LEGACY_KEY) !== '0' } catch { return true }
}

export function setShowLegacy(show: boolean) {
  try { localStorage.setItem(LEGACY_KEY, show ? '1' : '0') } catch { /* private mode */ }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  // Read requests honour the legacy filter; the server ignores it elsewhere.
  if (!init?.method && !getShowLegacy()) path += (path.includes('?') ? '&' : '?') + 'legacy=0'
  const token = getToken()
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  const body = await res.json().catch(() => ({ error: `Server error (${res.status})` }))
  if (res.status === 401 && token) setToken(null)
  if (!res.ok) throw new Error(body.error ?? res.statusText)
  return body
}
