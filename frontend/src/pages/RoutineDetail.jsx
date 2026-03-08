import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../services/api'
import { cacheSet, cacheGet } from '../services/offlineCache'
import useOnlineStatus from '../hooks/useOnlineStatus'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import AIRoutineView from '../components/routines/AIRoutineView'
import { WEEKDAY_NAMES, WEEKDAY_SHORT, getWeekdayMap, getNextTrainingDate } from '../utils/routineConstants'
import {
  ArrowLeft, X, Zap, Dumbbell, GripVertical, ChevronRight,
  Calendar, Moon, Pencil, WifiOff,
} from 'lucide-react'

export default function RoutineDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const online = useOnlineStatus()
  const [routine, setRoutine] = useState(null)
  const [loading, setLoading] = useState(true)
  const [offlineMode, setOfflineMode] = useState(false)
  const [showAIView, setShowAIView] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const cancellingNameRef = useRef(false)

  const todayDate = new Date().toISOString().split('T')[0]
  const [checked, setChecked] = useState(() => {
    try {
      const saved = localStorage.getItem(`routine_progress_${id}_${todayDate}`)
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })

  // Drag reorder state for day cards
  const [dragIdx, setDragIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [reordering, setReordering] = useState(false)
  const touchStartY = useRef(null)
  const touchStartIdx = useRef(null)
  const dayCardsRef = useRef([])
  const dayCardsContainerRef = useRef(null)
  const dragActiveRef = useRef(false)

  // ─── Load data ───
  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const r = await api.get(`/routines/${id}`)
        if (cancelled) return
        setRoutine(r.data)
        setOfflineMode(false)
        cacheSet(`routine_${id}`, r.data)
      } catch {
        if (cancelled) return
        const cachedRoutine = cacheGet(`routine_${id}`)
        if (cachedRoutine) {
          setRoutine(cachedRoutine)
          setOfflineMode(true)
        } else {
          navigate('/routines')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()
    return () => { cancelled = true }
  }, [id])

  // Re-fetch when coming back online
  useEffect(() => {
    if (online && offlineMode && routine) {
      api.get(`/routines/${id}`).then(r => {
        setRoutine(r.data)
        cacheSet(`routine_${id}`, r.data)
        setOfflineMode(false)
      }).catch(() => {})
    }
  }, [online])

  // ─── Drag-and-drop for day cards ───
  const restWeekdays = routine?.rest_weekdays || [6]
  const weekdayMap = routine ? getWeekdayMap(routine.days_per_week, restWeekdays) : {}
  const sortedDays = routine ? [...(routine.days || [])].sort((a, b) => {
    const wa = weekdayMap[a.day_number] ?? a.day_number
    const wb = weekdayMap[b.day_number] ?? b.day_number
    return wa - wb
  }) : []
  const sortedTrainingDays = sortedDays

  const handleDragDayStart = (idx) => { setDragIdx(idx) }
  const handleDragDayOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx) }
  const handleDragDayEnd = async () => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx && !reordering) {
      setReordering(true)
      const items = [...sortedTrainingDays]
      const [moved] = items.splice(dragIdx, 1)
      items.splice(dragOverIdx, 0, moved)
      try {
        await api.put('/routines/reorder-days', { routine_id: routine.id, day_order: items.map(d => d.id) })
        const r = await api.get(`/routines/${id}`)
        setRoutine(r.data)
        cacheSet(`routine_${id}`, r.data)
      } catch {}
      setReordering(false)
    }
    setDragIdx(null)
    setDragOverIdx(null)
  }

  // Touch drag for mobile
  const handleTouchStart = (e, idx) => {
    touchStartY.current = e.touches[0].clientY
    touchStartIdx.current = idx
    dragActiveRef.current = false
  }

  useEffect(() => {
    const container = dayCardsContainerRef.current
    if (!container) return
    const onTouchMove = (e) => {
      if (touchStartY.current === null) return
      const touchY = e.touches[0].clientY
      const diff = Math.abs(touchY - touchStartY.current)
      if (!dragActiveRef.current) {
        if (diff > 30) {
          dragActiveRef.current = true
          setDragIdx(touchStartIdx.current)
          e.preventDefault()
        }
        return
      }
      e.preventDefault()
      for (let i = 0; i < dayCardsRef.current.length; i++) {
        const card = dayCardsRef.current[i]
        if (!card) continue
        const rect = card.getBoundingClientRect()
        if (touchY >= rect.top && touchY <= rect.bottom) {
          setDragOverIdx(i)
          break
        }
      }
    }
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => container.removeEventListener('touchmove', onTouchMove)
  })

  const handleTouchEnd = async () => {
    if (dragActiveRef.current) {
      await handleDragDayEnd()
    } else {
      setDragIdx(null)
      setDragOverIdx(null)
    }
    touchStartY.current = null
    touchStartIdx.current = null
    dragActiveRef.current = false
  }

  const saveRestDays = async (newRest) => {
    try {
      await api.put(`/routines/${id}/schedule`, { rest_weekdays: newRest })
      setRoutine(r => ({ ...r, rest_weekdays: newRest }))
    } catch {}
  }

  if (loading) return <LoadingSpinner />
  if (!routine) return null

  const allIds = routine.days?.flatMap(d => d.exercises?.map(e => e.id) || []) || []
  const allDone = allIds.filter(eId => checked[eId]).length
  const todayWeekday = (new Date().getDay() + 6) % 7

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/routines')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <ArrowLeft size={20} /> Mis Rutinas
      </button>

      <div className="card">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {editingName ? (
                <form onSubmit={async (e) => {
                  e.preventDefault()
                  if (!nameInput.trim()) { setEditingName(false); return }
                  try {
                    await api.put(`/routines/${id}`, { name: nameInput.trim() })
                    setRoutine(r => ({ ...r, name: nameInput.trim() }))
                  } catch {}
                  setEditingName(false)
                }} className="flex items-center gap-2">
                  <input
                    autoFocus
                    className="input text-lg font-bold py-1 flex-1"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onBlur={async () => {
                      if (cancellingNameRef.current) { cancellingNameRef.current = false; setEditingName(false); return }
                      if (!nameInput.trim()) { setEditingName(false); return }
                      try {
                        await api.put(`/routines/${id}`, { name: nameInput.trim() })
                        setRoutine(r => ({ ...r, name: nameInput.trim() }))
                      } catch {}
                      setEditingName(false)
                    }}
                    onKeyDown={e => { if (e.key === 'Escape') { cancellingNameRef.current = true; setEditingName(false) } }}
                  />
                </form>
              ) : (
                <button
                  onClick={() => { setNameInput(routine.name); setEditingName(true) }}
                  className="flex items-center gap-2 text-left group"
                >
                  <h1 className="text-xl font-bold truncate">{routine.name}</h1>
                  <Pencil size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                </button>
              )}
              <div className="flex flex-wrap gap-2 text-sm text-gray-400 mt-1">
                <span className="bg-brand-50 dark:bg-brand-500/10 text-brand-500 px-2 py-0.5 rounded-full text-xs">{routine.split_type}</span>
                <span className="text-xs">{routine.days_per_week} dias/semana</span>
                {routine.generation_type === 'adaptativo' && (
                  <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full text-xs">Adaptativo</span>
                )}
                {offlineMode && (
                  <span className="flex items-center gap-1 text-xs text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                    <WifiOff size={10} /> Offline
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowSchedule(true)}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-gray-400 hover:text-brand-500 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-xl transition-colors">
              <Calendar size={14} /> Descansos
            </button>
            <button onClick={() => navigate('/routines/generate')}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-brand-500 hover:text-brand-400 bg-brand-50 dark:bg-brand-500/10 px-3 py-2 rounded-xl transition-colors">
              <Zap size={14} /> Nueva
            </button>
          </div>
        </div>
      </div>

      {/* Schedule Config Modal */}
      {showSchedule && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-800 animate-in">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <h3 className="font-bold">{routine.days_per_week >= 6 ? 'Elegir dia de descanso' : 'Elegir dias de descanso'}</h3>
              <button onClick={() => setShowSchedule(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-400">Selecciona tus dias de descanso. Los demas seran dias de entrenamiento.</p>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_NAMES.map((name, i) => {
                  const isRest = restWeekdays.includes(i)
                  const maxRest = 7 - routine.days_per_week
                  const canToggle = isRest || restWeekdays.length < maxRest
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (!canToggle && !isRest) return
                        const next = isRest
                          ? restWeekdays.filter(d => d !== i)
                          : [...restWeekdays, i]
                        saveRestDays(next)
                      }}
                      className={`py-2 rounded-lg text-[10px] font-semibold transition-colors ${
                        isRest
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                          : 'bg-brand-500 text-white'
                      } ${!canToggle && !isRest ? 'opacity-40' : ''}`}
                    >
                      {WEEKDAY_SHORT[i]}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center justify-between text-xs pt-2">
                <span className="text-gray-400">
                  <span className="inline-block w-3 h-3 rounded bg-brand-500 mr-1 align-middle" /> Entreno
                </span>
                <span className="text-gray-400">
                  <span className="inline-block w-3 h-3 rounded bg-gray-200 dark:bg-gray-700 mr-1 align-middle" /> Descanso
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI toggle */}
      {routine.ai_data && (
        <div className="flex gap-2">
          <button onClick={() => setShowAIView(false)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${!showAIView ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
            Entrenamiento
          </button>
          <button onClick={() => setShowAIView(true)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${showAIView ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
            Plan Adaptativo
          </button>
        </div>
      )}

      {showAIView && routine.ai_data ? (
        <AIRoutineView aiData={routine.ai_data} />
      ) : (
        <>
          {/* Overall progress */}
          {allIds.length > 0 && (
            <div className="card flex items-center justify-between">
              <span className="text-sm font-medium">Progreso de hoy</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all duration-300"
                    style={{ width: `${(allDone / allIds.length) * 100}%` }} />
                </div>
                <span className="text-xs text-gray-400 tabular-nums">{allDone}/{allIds.length}</span>
              </div>
            </div>
          )}

          {/* Week view: training days + rest days */}
          {(() => {
            dayCardsRef.current = []
            const weekCards = []
            let trainingIdx = 0
            for (let wd = 0; wd < 7; wd++) {
              const isRest = restWeekdays.includes(wd)
              if (isRest) {
                const isToday = wd === todayWeekday
                weekCards.push(
                  <div key={`rest-${wd}`}
                    className={`card bg-gray-50 dark:bg-gray-800/30 border border-dashed border-gray-200 dark:border-gray-700 opacity-60 ${isToday ? 'ring-2 ring-green-400/50' : ''}`}>
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <Moon size={16} className="text-gray-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-400">{WEEKDAY_NAMES[wd]} - Descanso</h3>
                          {isToday && <p className="text-[11px] text-green-500 font-medium">Hoy</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              } else {
                const dayEntry = sortedDays.find(d => weekdayMap[d.day_number] === wd)
                if (!dayEntry) continue

                const currentTrainingIdx = trainingIdx
                trainingIdx++

                const dayExIds = dayEntry.exercises?.map(e => e.id) || []
                const dayDone = dayExIds.filter(eId => checked[eId]).length
                const dayAllDone = dayExIds.length > 0 && dayDone === dayExIds.length
                const isToday = wd === todayWeekday
                const nextDate = getNextTrainingDate(wd)
                const nextDateStr = nextDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
                const isDragging = dragIdx === currentTrainingIdx
                const isDragOver = dragOverIdx === currentTrainingIdx

                weekCards.push(
                  <div key={dayEntry.id}
                    ref={el => dayCardsRef.current[currentTrainingIdx] = el}
                    draggable
                    onDragStart={() => handleDragDayStart(currentTrainingIdx)}
                    onDragOver={(e) => handleDragDayOver(e, currentTrainingIdx)}
                    onDragEnd={handleDragDayEnd}
                    onTouchStart={(e) => handleTouchStart(e, currentTrainingIdx)}
                    onTouchEnd={handleTouchEnd}
                    className={`card hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all cursor-grab active:cursor-grabbing ${dayAllDone ? 'border border-green-500/30' : ''} ${isToday ? 'ring-2 ring-brand-500/40' : ''} ${isDragging ? 'opacity-50 scale-95' : ''} ${isDragOver ? 'border-2 border-brand-500 border-dashed' : ''}`}>
                    <div className="flex items-center gap-2">
                      <GripVertical size={16} className="text-gray-300 dark:text-gray-600 flex-shrink-0 touch-none" />
                      <Link to={`/routines/${id}/day/${dayEntry.id}`} className="flex-1 text-left">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isToday ? 'bg-brand-500 text-white' : 'bg-brand-50 dark:bg-brand-500/10 text-brand-500'}`}>
                              <Dumbbell size={16} />
                            </div>
                            <div>
                              <h3 className="font-semibold">{WEEKDAY_NAMES[wd]} - {dayEntry.name}</h3>
                              <div className="flex items-center gap-2 mt-0.5">
                                {isToday ? (
                                  <span className="text-[11px] text-brand-500 font-semibold">Hoy · {dayExIds.length} ejercicios</span>
                                ) : (
                                  <span className="text-[11px] text-gray-400">Prox: {nextDateStr} · {dayExIds.length} ejercicios</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${dayAllDone ? 'text-green-500' : 'text-gray-400'}`}>
                              {dayDone}/{dayExIds.length}
                            </span>
                            <ChevronRight size={18} className="text-gray-400" />
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>
                )
              }
            }
            return <div ref={dayCardsContainerRef} className="space-y-2">{weekCards}</div>
          })()}
        </>
      )}
    </div>
  )
}
