import { useState, useEffect } from 'react'
import api from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import PageTour from '../components/ui/PageTour'
import { Link } from 'react-router-dom'
import { TrendingUp, AlertTriangle, Shield, Activity, Flame, Dumbbell, Calendar, Clock, ChevronRight } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

export default function Progress() {
  const [analysis, setAnalysis] = useState(null)
  const [exercises, setExercises] = useState([])
  const [selectedEx, setSelectedEx] = useState(null)
  const [orm, setOrm] = useState(null)
  const [progression, setProgression] = useState(null)
  const [fatigueData, setFatigueData] = useState([])
  const [workoutHistory, setWorkoutHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/ai/training-analysis'),
      api.get('/exercises'),
      api.get('/workouts/history'),
    ]).then(([a, e, w]) => {
      setAnalysis(a.data)
      setExercises(e.data)
      // Extract fatigue data from workout history
      const fData = (w.data || [])
        .filter(wk => wk.fatigue_level != null)
        .slice(0, 20)
        .reverse()
        .map(wk => ({
          date: new Date(wk.date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }),
          fatigue: wk.fatigue_level,
        }))
      setFatigueData(fData)
      setWorkoutHistory(w.data || [])
    }).finally(() => setLoading(false))
  }, [])

  const loadExerciseData = async (exId) => {
    setSelectedEx(exId)
    const [o, p] = await Promise.all([
      api.get(`/ai/1rm/${exId}`),
      api.get(`/ai/progression/${exId}`),
    ])
    setOrm(o.data)
    setProgression(p.data)
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Progreso & Análisis</h1>

      {/* Overtraining & Deload */}
      {analysis && (
        <div data-tour="progress-charts">
          <div className={`card border-l-4 ${
            analysis.overtraining_risk === 'high' ? 'border-l-red-500' :
            analysis.overtraining_risk === 'moderate' ? 'border-l-yellow-500' : 'border-l-green-500'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Shield size={18} className={
                analysis.overtraining_risk === 'high' ? 'text-red-500' :
                analysis.overtraining_risk === 'moderate' ? 'text-yellow-500' : 'text-green-500'
              } />
              <h3 className="font-semibold">Riesgo de Sobreentrenamiento: {
                analysis.overtraining_risk === 'high' ? 'Alto' :
                analysis.overtraining_risk === 'moderate' ? 'Moderado' : 'Bajo'
              }</h3>
            </div>
            {analysis.overtraining_alerts?.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-gray-500 mt-1">
                <AlertTriangle size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                <span>{a}</span>
              </div>
            ))}
          </div>

          {analysis.deload_recommended && (
            <div className="card border-l-4 border-l-purple-500">
              <div className="flex items-center gap-2 mb-1">
                <Activity size={18} className="text-purple-500" />
                <h3 className="font-semibold">Deload Recomendado</h3>
              </div>
              <p className="text-sm text-gray-500">{analysis.deload_reason}</p>
              <p className="text-xs text-gray-400 mt-1">Semanas entrenando: {analysis.weeks_since_deload}</p>
            </div>
          )}

          {/* Volume Analysis */}
          {analysis.volume_analysis?.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-3">Volumen Semanal por Músculo</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analysis.volume_analysis}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="muscle_group" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '12px', color: '#fff' }} />
                  <Bar dataKey="weekly_sets" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-3">
                {analysis.volume_analysis.filter(v => v.status !== 'optimal').map((v, i) => (
                  <p key={i} className={`text-xs px-2 py-1 rounded ${
                    v.status === 'high' ? 'bg-red-50 dark:bg-red-500/10 text-red-500' : 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-500'
                  }`}>{v.muscle_group}: {v.recommendation}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fatigue Trend */}
      {fatigueData.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-1 flex items-center gap-2">
            <Flame size={18} className="text-orange-500" /> Fatiga Reciente
          </h3>
          <div className="flex items-center gap-3 mb-3 text-xs text-gray-400">
            <span>Promedio: <span className="font-semibold text-gray-600 dark:text-gray-300">{(fatigueData.reduce((s, d) => s + d.fatigue, 0) / fatigueData.length).toFixed(1)}/10</span></span>
            <span>Último: <span className="font-semibold text-gray-600 dark:text-gray-300">{fatigueData[fatigueData.length - 1]?.fatigue}/10</span></span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={fatigueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '12px', color: '#fff' }} />
              <Line type="monotone" dataKey="fatigue" stroke="#f97316" strokeWidth={2} dot={{ r: 4, fill: '#f97316' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Exercise Selector for 1RM & Progression */}
      <div className="card">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <TrendingUp size={18} className="text-brand-500" /> Analizar Ejercicio
        </h3>
        <select className="input" value={selectedEx || ''} onChange={(e) => loadExerciseData(e.target.value)}>
          <option value="">Seleccionar ejercicio...</option>
          {exercises.filter(e => e.category === 'compound').map((ex) => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </select>

        {orm && orm.average_1rm > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-brand-50 dark:bg-brand-500/10 rounded-xl">
              <p className="text-lg font-bold text-brand-500">{orm.average_1rm} kg</p>
              <p className="text-xs text-gray-400">1RM Estimado</p>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <p className="text-lg font-bold">{orm.epley_1rm} kg</p>
              <p className="text-xs text-gray-400">Epley</p>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <p className="text-lg font-bold">{orm.brzycki_1rm} kg</p>
              <p className="text-xs text-gray-400">Brzycki</p>
            </div>
          </div>
        )}

        {progression && (
          <div className={`mt-3 p-3 rounded-xl text-sm ${
            progression.action === 'increase' ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400' :
            progression.action === 'decrease' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' :
            'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
          }`}>
            <p className="font-medium">
              {progression.action === 'increase' ? '↑ Aumentar peso' :
               progression.action === 'decrease' ? '↓ Reducir peso' : '→ Mantener peso'}
              : {progression.recommended_weight} kg
            </p>
            <p className="text-xs mt-1 opacity-75">{progression.reason}</p>
          </div>
        )}
      </div>

      {/* Historial de Entrenos */}
      <div className="card">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Dumbbell size={18} className="text-brand-500" /> Historial de Entrenos
        </h3>
        {workoutHistory.length === 0 ? (
          <div className="text-center py-6">
            <Dumbbell size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500">No hay entrenamientos registrados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {workoutHistory.map((w) => {
              const getFatigueEmoji = (level) => {
                if (!level) return ''
                if (level <= 2) return '😊'
                if (level <= 4) return '💪'
                if (level <= 6) return '😤'
                if (level <= 8) return '😓'
                return '💀'
              }
              return (
                <Link
                  key={w.id}
                  to={`/workouts/${w.id}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-500/10 text-brand-500">
                      <Dumbbell size={16} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{w.sets?.length || 0} series</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} /> {new Date(w.date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                        </span>
                        {w.duration_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} /> {w.duration_minutes}min
                          </span>
                        )}
                        {w.fatigue_level && (
                          <span>{getFatigueEmoji(w.fatigue_level)} {w.fatigue_level}/10</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-400" />
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <PageTour
        pageKey="progress"
        steps={[
          { target: '[data-tour="progress-charts"]', title: 'Tu Progreso', description: 'Graficas de tu evolucion en fuerza y rendimiento.', position: 'bottom' },
        ]}
      />
    </div>
  )
}
