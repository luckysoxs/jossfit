export const CARDIO_TYPES = [
  { id: 'hiit', label: 'HIIT', description: 'Intervalos de alta intensidad', emoji: '⚡' },
  { id: 'liss', label: 'LISS', description: 'Cardio de baja intensidad constante', emoji: '💚' },
  { id: 'steady', label: 'Steady State', description: 'Ritmo constante moderado', emoji: '🎯' },
]

export const EQUIPMENT = [
  { id: 'treadmill', label: 'Caminadora', emoji: '🏃', unit: 'km/h' },
  { id: 'bike', label: 'Bicicleta', emoji: '🚴', unit: 'watts' },
  { id: 'elliptical', label: 'Elíptica', emoji: '🏋️', unit: 'RPM' },
]

export const DURATIONS = [15, 20, 25, 30]

export const LEVELS = [
  { level: 0, label: 'Muy Fácil', color: 'bg-blue-500' },
  { level: 1, label: 'Fácil', color: 'bg-green-500' },
  { level: 2, label: 'Moderado', color: 'bg-yellow-500' },
  { level: 3, label: 'Difícil', color: 'bg-orange-500' },
  { level: 4, label: 'Muy Difícil', color: 'bg-red-500' },
  { level: 5, label: 'Máximo', color: 'bg-red-700' },
]

export const HIIT_PROTOCOLS = {
  treadmill: [
    { level: 0, recovery: [4, 5], work: [5, 6], workSec: 30, recoverySec: 90 },
    { level: 1, recovery: [5, 6], work: [7, 9], workSec: 30, recoverySec: 60 },
    { level: 2, recovery: [5, 6], work: [9, 11], workSec: 30, recoverySec: 60 },
    { level: 3, recovery: [6, 7], work: [11, 13], workSec: 40, recoverySec: 50 },
    { level: 4, recovery: [6, 7], work: [13, 15], workSec: 45, recoverySec: 45 },
    { level: 5, recovery: [7, 8], work: [15, 17], workSec: 60, recoverySec: 30 },
  ],
  bike: [
    { level: 0, recovery: [50, 70], work: [70, 90], workSec: 30, recoverySec: 90 },
    { level: 1, recovery: [60, 80], work: [90, 120], workSec: 30, recoverySec: 60 },
    { level: 2, recovery: [70, 90], work: [120, 150], workSec: 30, recoverySec: 60 },
    { level: 3, recovery: [80, 100], work: [150, 180], workSec: 40, recoverySec: 50 },
    { level: 4, recovery: [90, 110], work: [180, 220], workSec: 45, recoverySec: 45 },
    { level: 5, recovery: [100, 120], work: [220, 270], workSec: 60, recoverySec: 30 },
  ],
  elliptical: [
    { level: 0, recovery: [80, 100], work: [100, 120], workSec: 30, recoverySec: 90 },
    { level: 1, recovery: [90, 110], work: [120, 140], workSec: 30, recoverySec: 60 },
    { level: 2, recovery: [100, 120], work: [140, 160], workSec: 30, recoverySec: 60 },
    { level: 3, recovery: [110, 130], work: [160, 180], workSec: 40, recoverySec: 50 },
    { level: 4, recovery: [120, 140], work: [180, 200], workSec: 45, recoverySec: 45 },
    { level: 5, recovery: [130, 150], work: [200, 220], workSec: 60, recoverySec: 30 },
  ],
}

export const LISS_PROTOCOLS = {
  treadmill: [
    { level: 0, pace: [4, 5] }, { level: 1, pace: [5, 6] }, { level: 2, pace: [6, 7] },
    { level: 3, pace: [7, 8] }, { level: 4, pace: [8, 9] }, { level: 5, pace: [9, 10] },
  ],
  bike: [
    { level: 0, pace: [50, 70] }, { level: 1, pace: [70, 90] }, { level: 2, pace: [90, 110] },
    { level: 3, pace: [110, 130] }, { level: 4, pace: [130, 160] }, { level: 5, pace: [160, 200] },
  ],
  elliptical: [
    { level: 0, pace: [80, 100] }, { level: 1, pace: [100, 120] }, { level: 2, pace: [120, 140] },
    { level: 3, pace: [140, 160] }, { level: 4, pace: [160, 180] }, { level: 5, pace: [180, 200] },
  ],
}

export function generateHIITIntervals(equipment, level, durationMin) {
  const protocol = HIIT_PROTOCOLS[equipment]?.find(p => p.level === level)
  if (!protocol) return []
  const totalSeconds = durationMin * 60
  const intervalLength = protocol.workSec + protocol.recoverySec
  const numIntervals = Math.floor(totalSeconds / intervalLength)
  const intervals = []
  for (let i = 0; i < numIntervals; i++) {
    intervals.push({ type: 'work', duration: protocol.workSec, range: protocol.work })
    intervals.push({ type: 'recovery', duration: protocol.recoverySec, range: protocol.recovery })
  }
  let accumulated = intervals.reduce((s, i) => s + i.duration, 0)
  if (accumulated < totalSeconds) {
    const remaining = totalSeconds - accumulated
    intervals.push({ type: 'work', duration: Math.min(remaining, protocol.workSec), range: protocol.work })
  }
  return intervals
}

export function generateSteadyIntervals(equipment, level, durationMin) {
  const protocol = LISS_PROTOCOLS[equipment]?.find(p => p.level === level)
  if (!protocol) return []
  return [{ type: 'steady', duration: durationMin * 60, range: protocol.pace }]
}
