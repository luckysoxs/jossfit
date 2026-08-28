// Techo de ejercicios renderizados a la vez en cualquier lista.
//
// El catalogo tiene 204 ejercicios. Pintarlos todos son 829 nodos DOM, y cada
// tecla del buscador obliga a React a reconciliarlos: en un telefono de gama
// media eso congela la interfaz. El filtrado en si cuesta 0,03 ms, asi que lo
// que hay que acotar es el volumen renderizado, no el calculo.
//
// Cubierto por ExercisePickerModal.test.jsx.
export const MAX_EJERCICIOS_VISIBLES = 40

export const MUSCLE_LABELS = {
  chest: 'Pecho', back: 'Espalda', shoulders: 'Hombros', biceps: 'Bíceps',
  triceps: 'Tríceps', quadriceps: 'Cuádriceps', hamstrings: 'Isquiotibiales',
  glutes: 'Glúteos', calves: 'Pantorrillas', abs: 'Abdominales',
  traps: 'Trapecios', forearms: 'Antebrazos', cardio: 'Cardio', full_body: 'Cuerpo Completo',
}

export const MUSCLE_COLORS = {
  chest: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
  back: 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400',
  shoulders: 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400',
  biceps: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
  triceps: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
  quadriceps: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
  hamstrings: 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
  glutes: 'bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400',
  calves: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
  abs: 'bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400',
  traps: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
  forearms: 'bg-lime-100 dark:bg-lime-500/20 text-lime-600 dark:text-lime-400',
  cardio: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
  full_body: 'bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400',
}

// Los mismos tonos que MUSCLE_COLORS, pero en hex: las clases de Tailwind no
// sirven para pintar un canvas. Es el shade 500 de cada color.
export const MUSCLE_HEX = {
  chest: '#3b82f6', back: '#22c55e', shoulders: '#f97316', biceps: '#a855f7',
  triceps: '#6366f1', quadriceps: '#ef4444', hamstrings: '#f43f5e',
  glutes: '#ec4899', calves: '#f59e0b', abs: '#14b8a6', traps: '#06b6d4',
  forearms: '#84cc16', cardio: '#ef4444',
}

export const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function getWeekdayMap(daysPerWeek, restWeekdays = [6]) {
  const trainingWeekdays = []
  for (let i = 0; i < 7; i++) {
    if (!restWeekdays.includes(i)) trainingWeekdays.push(i)
  }
  const map = {}
  for (let i = 0; i < Math.min(daysPerWeek, trainingWeekdays.length); i++) {
    map[i + 1] = trainingWeekdays[i]
  }
  return map
}

export function getNextTrainingDate(weekdayIndex) {
  const today = new Date()
  const todayWeekday = (today.getDay() + 6) % 7
  let daysAhead = weekdayIndex - todayWeekday
  if (daysAhead < 0) daysAhead += 7
  const nextDate = new Date(today)
  nextDate.setDate(today.getDate() + daysAhead)
  return nextDate
}

export function exDisplayName(ex) {
  if (!ex) return 'Ejercicio'
  if (ex.name_es) return ex.name_es
  return ex.name
}

export function exSubtitle(ex) {
  if (!ex) return ''
  if (ex.name_es) return ex.name
  return ''
}

// El progreso de una rutina se agrupa por semana (lunes a domingo), no por dia:
// lo marcado el lunes sigue visible el jueves y se limpia solo al cambiar de
// semana. Espejo de week_start_mx() en el backend.
export function getWeekStartDate(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const mondayOffset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - mondayOffset)
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD local
}

export function progressStorageKey(routineId, date = new Date()) {
  return `routine_progress_${routineId}_w${getWeekStartDate(date)}`
}
