import { createContext, useContext, useState, useCallback } from 'react'

const WeightUnitCtx = createContext(null)
const KG_TO_LB = 2.20462
const LS_KEY = 'weight_unit'

export function WeightUnitProvider({ children }) {
  const [unit, setUnit] = useState(() => localStorage.getItem(LS_KEY) || 'kg')

  const toggleUnit = useCallback((newUnit) => {
    setUnit(newUnit)
    localStorage.setItem(LS_KEY, newUnit)
  }, [])

  /** Convert kg value to display unit (rounds to 1 decimal) */
  const displayWeight = useCallback((kg) => {
    if (kg == null) return 0
    if (unit === 'lb') return Math.round(kg * KG_TO_LB * 10) / 10
    return kg
  }, [unit])

  /** Convert input value (in current unit) to kg for storage */
  const toKg = useCallback((value) => {
    const v = parseFloat(value)
    if (isNaN(v)) return 0
    if (unit === 'lb') return Math.round(v / KG_TO_LB * 10) / 10
    return v
  }, [unit])

  return (
    <WeightUnitCtx.Provider value={{ unit, toggleUnit, displayWeight, toKg }}>
      {children}
    </WeightUnitCtx.Provider>
  )
}

export function useWeightUnit() {
  return useContext(WeightUnitCtx)
}
