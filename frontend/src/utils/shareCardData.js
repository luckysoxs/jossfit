import { MUSCLE_HEX } from './routineConstants'

// Datos de presentacion para las tarjetas compartibles.

/** Color de acento actual del usuario, en hex, para pintar el canvas. */
export function brandAccent() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--brand-500').trim()
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : '#3b82f6'
}

export function todayLabel(date = new Date()) {
  return date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Redondea a 1 decimal y quita el ".0" (102.5 -> "102.5", 120.0 -> "120"). */
export function niceNumber(value) {
  return String(Math.round(value * 10) / 10)
}

/** 5240 -> "5,240" ; 12400 -> "12.4k" para que quepa en la tarjeta. */
export function compactNumber(value) {
  const n = Math.round(value)
  if (n >= 10000) return `${Math.round(n / 100) / 10}k`
  return n.toLocaleString('es-MX')
}

/** 1RM estimado: promedio de Epley y Brzycki, igual que el backend. */
export function estimate1RM(weight, reps) {
  if (!weight || !reps || reps < 1) return null
  const epley = weight * (1 + reps / 30)
  const brzycki = reps < 37 ? (weight * 36) / (37 - reps) : epley
  return Math.round(((epley + brzycki) / 2) * 10) / 10
}

/**
 * Color de la tarjeta segun el musculo del ejercicio: un PR de pecho sale azul,
 * uno de pierna rojo. Asi cada record se distingue de un vistazo.
 * `full_body` y los desconocidos caen al acento del usuario.
 */
export function muscleAccent(muscleGroup) {
  return MUSCLE_HEX[muscleGroup] || brandAccent()
}

/** Musculo dominante de un dia, a partir de su campo `focus` ("back,biceps"). */
export function focusAccent(focus) {
  const first = (focus || '').split(',')[0]?.trim()
  return muscleAccent(first)
}
