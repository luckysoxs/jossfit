import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { CloudOff, RefreshCw, TrendingUp } from 'lucide-react'

import api from '../../services/api'
import { useWeightUnit } from '../../contexts/WeightUnitContext'

// Rangos cortos a propositio: con 7 dias, un ejercicio que se entrena una vez
// por semana sale con un punto suelto y la grafica se ve rota.
const RANGOS = [
  { etiqueta: '30 días', days: 30 },
  { etiqueta: '3 meses', days: 90 },
  { etiqueta: '1 año', days: 365 },
  { etiqueta: 'Todo', days: null },
]

const METRICAS = [
  { clave: 'max_weight', etiqueta: 'Peso', titulo: 'Peso más alto del día' },
  { clave: 'volume', etiqueta: 'Volumen', titulo: 'Peso × reps de todas las series' },
  { clave: 'est_1rm', etiqueta: '1RM', titulo: 'Máximo estimado a partir de peso y reps' },
]

/** '2026-11-10' -> '10 nov'. Partido a mano: new Date('2026-11-10') es UTC y
 *  en Mexico retrocede un dia, que correria toda la grafica. */
function diaCorto(iso) {
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const [, mes, dia] = iso.split('-')
  return `${Number(dia)} ${MESES[Number(mes) - 1]}`
}

export default function ExerciseProgressChart({ exerciseId, exerciseName }) {
  const { unit, displayWeight } = useWeightUnit()
  const [rango, setRango] = useState(RANGOS[0])
  const [metrica, setMetrica] = useState(METRICAS[0])
  const [puntos, setPuntos] = useState([])
  const [loading, setLoading] = useState(true)
  const [fallo, setFallo] = useState(false)

  const cargar = useCallback(() => {
    setLoading(true)
    const params = rango.days ? { days: rango.days } : {}
    return api.get(`/workouts/exercise-history/${exerciseId}`, { params })
      .then((r) => {
        setPuntos(r.data?.points || [])
        setFallo(false)
      })
      // Un fallo no es lo mismo que no haber entrenado nunca. Decir "sin
      // registros" cuando no pudimos preguntar es mentir.
      .catch(() => setFallo(true))
      .finally(() => setLoading(false))
  }, [exerciseId, rango])

  useEffect(() => { cargar() }, [cargar])

  // El 1RM no existe los dias de reps altas, y Recharts corta la linea en los
  // nulos en vez de dibujar un cero que no paso.
  const datos = puntos.map((p) => ({
    dia: diaCorto(p.date),
    valor: p[metrica.clave] == null ? null : displayWeight(p[metrica.clave]),
    sets: p.sets,
  }))

  const ultimo = puntos[puntos.length - 1]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {RANGOS.map((r) => (
          <button
            key={r.etiqueta}
            onClick={() => setRango(r)}
            className={`text-xs font-medium py-1.5 px-3 rounded-lg transition-colors ${
              r.etiqueta === rango.etiqueta
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          >
            {r.etiqueta}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {METRICAS.map((m) => (
          <button
            key={m.clave}
            onClick={() => setMetrica(m)}
            title={m.titulo}
            className={`text-xs font-medium py-1.5 px-3 rounded-lg transition-colors ${
              m.clave === metrica.clave
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          >
            {m.etiqueta}
          </button>
        ))}
      </div>

      {ultimo && !fallo && (
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2.5">
          <p className="text-xs text-gray-400">Último día · {diaCorto(ultimo.date)}</p>
          <p className="text-sm font-medium mt-0.5">
            {ultimo.sets.map((s, i) => (
              <span key={i}>
                {i > 0 && <span className="text-gray-400"> · </span>}
                {displayWeight(s.weight_kg)} {unit} × {s.reps}
              </span>
            ))}
          </p>
        </div>
      )}

      {fallo ? (
        <div className="text-center py-8">
          <CloudOff size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-gray-500">No se pudo cargar el progreso</p>
          <button onClick={cargar} className="btn-secondary inline-flex items-center gap-1.5 text-xs py-1.5 px-3 mt-3">
            <RefreshCw size={12} /> Reintentar
          </button>
        </div>
      ) : loading ? (
        <div className="h-48 flex items-center justify-center">
          <p className="text-sm text-gray-400">Cargando…</p>
        </div>
      ) : datos.length === 0 ? (
        <div className="text-center py-8">
          <TrendingUp size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-gray-500">Sin registros en este rango</p>
          <p className="text-xs text-gray-400 mt-1">Entrena {exerciseName} y aquí verás tu progreso</p>
        </div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={datos} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={44} />
              <Tooltip content={<DetalleDelDia unit={unit} displayWeight={displayWeight} metrica={metrica} />} />
              <Line
                type="monotone"
                dataKey="valor"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

/** El tooltip muestra las series de ese dia, que es el dato que de verdad se
 *  quiere al tocar un punto: con cuanto y cuantas reps se entreno. */
function DetalleDelDia({ active, payload, label, unit, displayWeight, metrica }) {
  if (!active || !payload?.length) return null
  const { valor, sets } = payload[0].payload
  return (
    <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold">{label}</p>
      <p className="text-xs text-brand-500 mt-0.5">
        {metrica.etiqueta}: {valor == null ? '—' : `${valor} ${unit}`}
      </p>
      <div className="mt-1.5 space-y-0.5">
        {(sets || []).map((s, i) => (
          <p key={i} className="text-[11px] text-gray-500 dark:text-gray-400">
            {displayWeight(s.weight_kg)} {unit} × {s.reps}
          </p>
        ))}
      </div>
    </div>
  )
}
