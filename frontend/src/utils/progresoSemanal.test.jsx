import { describe, it, expect } from 'vitest'
import { getWeekStartDate, progressStorageKey } from './routineConstants'
import { compactNumber, niceNumber, estimate1RM } from './shareCardData'

describe('progreso semanal', () => {
  it('lunes a domingo caen en la misma semana', () => {
    // 2026-08-24 es lunes; el domingo 2026-08-30 cierra esa semana.
    const lunes = getWeekStartDate(new Date(2026, 7, 24))
    for (const dia of [24, 25, 26, 27, 28, 29, 30]) {
      expect(getWeekStartDate(new Date(2026, 7, dia))).toBe(lunes)
    }
    expect(lunes).toBe('2026-08-24')
  })

  it('el lunes siguiente abre semana nueva: ahi si se resetea', () => {
    expect(getWeekStartDate(new Date(2026, 7, 30))).not.toBe(
      getWeekStartDate(new Date(2026, 7, 31))
    )
    expect(getWeekStartDate(new Date(2026, 7, 31))).toBe('2026-08-31')
  })

  it('el jueves lee la misma clave que el lunes: era el bug', () => {
    const lunes = progressStorageKey(7, new Date(2026, 7, 24))
    const jueves = progressStorageKey(7, new Date(2026, 7, 27))
    expect(jueves).toBe(lunes)
  })

  it('rutinas distintas no comparten clave', () => {
    const d = new Date(2026, 7, 27)
    expect(progressStorageKey(7, d)).not.toBe(progressStorageKey(8, d))
  })
})

describe('cifras de la tarjeta', () => {
  it('compacta el volumen para que quepa', () => {
    expect(compactNumber(5240)).toBe('5,240')
    expect(compactNumber(12400)).toBe('12.4k')
  })

  it('quita el decimal cuando sobra', () => {
    expect(niceNumber(120)).toBe('120')
    expect(niceNumber(102.5)).toBe('102.5')
  })

  it('estima el 1RM por encima del peso levantado', () => {
    // Promedio de Epley y Brzycki, igual que calculate_1rm_* del backend:
    // a 1 rep Epley ya suma un 3%, por eso no da 100 clavado.
    expect(estimate1RM(100, 1)).toBeCloseTo(101.7, 1)
    expect(estimate1RM(100, 8)).toBeGreaterThan(estimate1RM(100, 1))
    expect(estimate1RM(0, 8)).toBeNull()
  })
})
