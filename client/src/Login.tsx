import { useState } from 'react'
import { api, setToken } from './api'

export function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const { token } = await api<{ token: string }>('/login', { method: 'POST', body: JSON.stringify({ password }) })
      setToken(token)
      onLogin()
    } catch (err) { setError((err as Error).message) }
  }
  return (
    <form className="card form narrow" onSubmit={submit}>
      <h3 className="card-title">Log in to make changes</h3>
      <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoFocus /></label>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="primary wide">Log in</button>
    </form>
  )
}
