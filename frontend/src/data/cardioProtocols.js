export const CARDIO_TYPES = [
  { id: 'hiit', label: 'HIIT', description: 'Intervalos de alta intensidad', emoji: '⚡' },
  { id: 'liss', label: 'LISS', description: 'Cardio de baja intensidad constante', emoji: '💚' },
  { id: 'steady', label: 'Steady State', description: 'Ritmo constante moderado', emoji: '🎯' },
]

export const EQUIPMENT = [
  { id: 'treadmill', label: 'Caminadora', emoji: '🏃', unit: 'km/h' },
  { id: 'bike', label: 'Bicicleta', emoji: '🚴', unit: 'watts' },
  { id: 'elliptical', label: 'Elíptica', emoji: '🏋️', unit: 'RPM' },
  { id: 'stair_climber', label: 'Escaladora Infinita', emoji: '🪜', unit: 'vel' },
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
    { level: 0, recovery: [4, 5], moderate: [5, 6], work: [6, 7], recoverySec: 45, moderateSec: 25, workSec: 20 },
    { level: 1, recovery: [5, 6], moderate: [7, 8], work: [9, 10], recoverySec: 35, moderateSec: 20, workSec: 20 },
    { level: 2, recovery: [5, 6], moderate: [8, 9], work: [10, 12], recoverySec: 30, moderateSec: 20, workSec: 20 },
    { level: 3, recovery: [6, 7], moderate: [9, 10], work: [12, 14], recoverySec: 25, moderateSec: 20, workSec: 25 },
    { level: 4, recovery: [6, 7], moderate: [10, 12], work: [14, 16], recoverySec: 20, moderateSec: 20, workSec: 30 },
    { level: 5, recovery: [7, 8], moderate: [12, 14], work: [16, 18], recoverySec: 15, moderateSec: 15, workSec: 30 },
  ],
  bike: [
    { level: 0, recovery: [50, 70], moderate: [70, 80], work: [80, 100], recoverySec: 45, moderateSec: 25, workSec: 20 },
    { level: 1, recovery: [60, 80], moderate: [90, 110], work: [110, 130], recoverySec: 35, moderateSec: 20, workSec: 20 },
    { level: 2, recovery: [70, 90], moderate: [110, 130], work: [140, 160], recoverySec: 30, moderateSec: 20, workSec: 20 },
    { level: 3, recovery: [80, 100], moderate: [130, 150], work: [170, 200], recoverySec: 25, moderateSec: 20, workSec: 25 },
    { level: 4, recovery: [90, 110], moderate: [150, 180], work: [200, 240], recoverySec: 20, moderateSec: 20, workSec: 30 },
    { level: 5, recovery: [100, 120], moderate: [180, 210], work: [240, 280], recoverySec: 15, moderateSec: 15, workSec: 30 },
  ],
  elliptical: [
    { level: 0, recovery: [80, 100], moderate: [100, 110], work: [110, 130], recoverySec: 45, moderateSec: 25, workSec: 20 },
    { level: 1, recovery: [90, 110], moderate: [120, 130], work: [135, 150], recoverySec: 35, moderateSec: 20, workSec: 20 },
    { level: 2, recovery: [100, 120], moderate: [130, 140], work: [150, 170], recoverySec: 30, moderateSec: 20, workSec: 20 },
    { level: 3, recovery: [110, 130], moderate: [150, 160], work: [170, 190], recoverySec: 25, moderateSec: 20, workSec: 25 },
    { level: 4, recovery: [120, 140], moderate: [160, 175], work: [190, 210], recoverySec: 20, moderateSec: 20, workSec: 30 },
    { level: 5, recovery: [130, 150], moderate: [175, 195], work: [210, 230], recoverySec: 15, moderateSec: 15, workSec: 30 },
  ],
  stair_climber: [
    { level: 0, recovery: [3, 4], moderate: [4, 5], work: [5, 6], recoverySec: 45, moderateSec: 25, workSec: 20 },
    { level: 1, recovery: [4, 5], moderate: [5, 6], work: [7, 8], recoverySec: 35, moderateSec: 20, workSec: 20 },
    { level: 2, recovery: [4, 5], moderate: [6, 7], work: [8, 9], recoverySec: 30, moderateSec: 20, workSec: 20 },
    { level: 3, recovery: [5, 6], moderate: [7, 8], work: [9, 11], recoverySec: 25, moderateSec: 20, workSec: 25 },
    { level: 4, recovery: [5, 6], moderate: [8, 9], work: [11, 13], recoverySec: 20, moderateSec: 20, workSec: 30 },
    { level: 5, recovery: [6, 7], moderate: [9, 11], work: [13, 15], recoverySec: 15, moderateSec: 15, workSec: 30 },
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
  stair_climber: [
    { level: 0, pace: [3, 4] }, { level: 1, pace: [4, 5] }, { level: 2, pace: [5, 6] },
    { level: 3, pace: [6, 7] }, { level: 4, pace: [7, 9] }, { level: 5, pace: [9, 11] },
  ],
}

export function generateHIITIntervals(equipment, level, durationMin) {
  const protocol = HIIT_PROTOCOLS[equipment]?.find(p => p.level === level)
  if (!protocol) return []
  const totalSeconds = durationMin * 60
  const cycleLength = protocol.recoverySec + protocol.moderateSec + protocol.workSec
  const numCycles = Math.floor(totalSeconds / cycleLength)
  const intervals = []
  for (let i = 0; i < numCycles; i++) {
    intervals.push({ type: 'recovery', duration: protocol.recoverySec, range: protocol.recovery })
    intervals.push({ type: 'moderate', duration: protocol.moderateSec, range: protocol.moderate })
    intervals.push({ type: 'work', duration: protocol.workSec, range: protocol.work })
  }
  let accumulated = intervals.reduce((s, i) => s + i.duration, 0)
  const phases = [
    { type: 'recovery', duration: protocol.recoverySec, range: protocol.recovery },
    { type: 'moderate', duration: protocol.moderateSec, range: protocol.moderate },
    { type: 'work', duration: protocol.workSec, range: protocol.work },
  ]
  for (const phase of phases) {
    if (accumulated >= totalSeconds) break
    const remaining = totalSeconds - accumulated
    intervals.push({ ...phase, duration: Math.min(remaining, phase.duration) })
    accumulated += Math.min(remaining, phase.duration)
  }
  return intervals
}

export function generateSteadyIntervals(equipment, level, durationMin) {
  const protocol = LISS_PROTOCOLS[equipment]?.find(p => p.level === level)
  if (!protocol) return []
  return [{ type: 'steady', duration: durationMin * 60, range: protocol.pace }]
}

export const LISS_BPM_ZONES = [
  { level: 0, bpm: [100, 110], label: 'Muy Suave', color: 'bg-blue-500' },
  { level: 1, bpm: [110, 120], label: 'Suave', color: 'bg-green-500' },
  { level: 2, bpm: [120, 130], label: 'Moderado', color: 'bg-yellow-500' },
  { level: 3, bpm: [130, 140], label: 'Moderado-Alto', color: 'bg-orange-500' },
  { level: 4, bpm: [140, 150], label: 'Alto', color: 'bg-red-500' },
  { level: 5, bpm: [150, 160], label: 'Muy Alto', color: 'bg-red-700' },
]

export const LISS_EQUIPMENT_GUIDANCE = {
  treadmill: [
    { level: 0, speed: [4, 5], incline: [0, 1] },
    { level: 1, speed: [5, 6], incline: [1, 2] },
    { level: 2, speed: [6, 7], incline: [2, 4] },
    { level: 3, speed: [6.5, 7.5], incline: [4, 6] },
    { level: 4, speed: [7, 8], incline: [5, 8] },
    { level: 5, speed: [7.5, 9], incline: [6, 10] },
  ],
  bike: [
    { level: 0, watts: [60, 80] },
    { level: 1, watts: [80, 100] },
    { level: 2, watts: [100, 130] },
    { level: 3, watts: [130, 160] },
    { level: 4, watts: [160, 200] },
    { level: 5, watts: [200, 250] },
  ],
  elliptical: [
    { level: 0, rpm: [80, 100] },
    { level: 1, rpm: [100, 120] },
    { level: 2, rpm: [120, 140] },
    { level: 3, rpm: [140, 160] },
    { level: 4, rpm: [160, 180] },
    { level: 5, rpm: [180, 200] },
  ],
  stair_climber: [
    { level: 0, speed: [3, 4] },
    { level: 1, speed: [4, 5] },
    { level: 2, speed: [5, 6] },
    { level: 3, speed: [6, 7] },
    { level: 4, speed: [7, 9] },
    { level: 5, speed: [9, 11] },
  ],
}

export function generateLISSIntervals(level, durationMin) {
  const zone = LISS_BPM_ZONES.find(z => z.level === level)
  if (!zone) return []
  return [{ type: 'liss', duration: durationMin * 60, range: zone.bpm }]
}
