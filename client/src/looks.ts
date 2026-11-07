// Every player's 8-bit character, loaded once and shared by all avatars on the page.
import { useSyncExternalStore } from 'react'
import { api } from './api'
import { defaultLook, isLook, type Look } from './sprite'

let looks: Record<string, Look> = {}
let requested = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

function load() {
  if (requested) return
  requested = true
  api<Record<string, Look>>('/looks').then(l => { looks = l; emit() }, () => { requested = false })
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

export function setLook(name: string, look: Look) {
  looks = { ...looks, [name]: look }
  emit()
}

// A player's character: their saved one, or the default made from their name.
export function useLook(name: string): Look {
  load()
  const all = useSyncExternalStore(subscribe, () => looks)
  const saved = all[name]
  return isLook(saved) ? saved : defaultLook(name)
}
