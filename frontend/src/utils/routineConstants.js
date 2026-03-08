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
