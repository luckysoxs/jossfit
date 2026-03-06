import { useState } from 'react'
import {
  AlertTriangle, Shield, Heart, Flame, Wind, Apple,
  TrendingUp, ChevronDown, ChevronUp, Activity,
} from 'lucide-react'

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-brand-500" />}
          <span className="text-sm font-semibold">{title}</span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

export default function AIRoutineView({ aiData }) {
  if (!aiData) return null

  const { perfil, disclaimer, alertas_seguridad, rutina, nutricion_basica, progresion } = aiData

  return (
    <div className="space-y-4">
      {/* Safety Banner */}
      {perfil?.modo === 'adaptativo' && (
        <div className="card bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-amber-700 dark:text-amber-400 text-sm">
                Modo Adaptativo — Riesgo: {perfil.riesgo_global?.toUpperCase()}
              </h3>
              {disclaimer && (
                <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">{disclaimer}</p>
              )}
              {perfil.requiere_supervision && (
                <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
                  <Shield size={14} />
                  Requiere supervisión médica presencial
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Safety Alerts */}
      {alertas_seguridad?.length > 0 && (
        <CollapsibleSection title={`Alertas de Seguridad (${alertas_seguridad.length})`} icon={AlertTriangle} defaultOpen>
          <ul className="space-y-1.5">
            {alertas_seguridad.map((alert, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                <span className="text-amber-500 mt-0.5">•</span>
                {alert}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {/* Days with enriched data */}
      {rutina?.dias?.map((day) => (
        <div key={day.dia} className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">
              Día {day.dia}: {day.nombre}
            </h3>
            <span className="text-xs text-gray-400">{day.enfoque}</span>
          </div>

          {/* Warmup */}
          {day.calentamiento && (
            <CollapsibleSection title={`Calentamiento (${day.calentamiento.duracion} min)`} icon={Flame}>
              <ul className="space-y-1">
                {day.calentamiento.ejercicios?.map((ex, i) => (
                  <li key={i} className="text-xs text-gray-500 dark:text-gray-400">• {ex}</li>
                ))}
              </ul>
            </CollapsibleSection>
          )}

          {/* Exercises */}
          <div className="space-y-2">
            {day.ejercicios?.map((ex, i) => (
              <div key={i} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{ex.nombre}</p>
                    <p className="text-xs text-gray-400">{ex.grupo_muscular}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-brand-500">
                      {ex.series} × {ex.repeticiones}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      RPE {ex.rpe} · {ex.descanso_seg}s desc · {ex.tempo}
                    </p>
                  </div>
                </div>
                {ex.notas_seguridad && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                    <AlertTriangle size={10} />
                    {ex.notas_seguridad}
                  </p>
                )}
                {ex.alternativa_facil && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Alternativa: {ex.alternativa_facil}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Cardio */}
          {day.cardio && (
            <CollapsibleSection title={`Cardio (${day.cardio.duracion} min)`} icon={Activity}>
              <div className="text-xs space-y-1">
                <p><strong>Tipo:</strong> {day.cardio.tipo}</p>
                <p><strong>Intensidad:</strong> {day.cardio.intensidad}</p>
                {day.cardio.notas && <p className="text-gray-400">{day.cardio.notas}</p>}
              </div>
            </CollapsibleSection>
          )}

          {/* Cooldown */}
          {day.vuelta_calma && (
            <CollapsibleSection title={`Vuelta a la Calma (${day.vuelta_calma.duracion} min)`} icon={Wind}>
              <ul className="space-y-1">
                {day.vuelta_calma.ejercicios?.map((ex, i) => (
                  <li key={i} className="text-xs text-gray-500 dark:text-gray-400">• {ex}</li>
                ))}
              </ul>
            </CollapsibleSection>
          )}
        </div>
      ))}

      {/* Nutrition */}
      {nutricion_basica && (
        <CollapsibleSection title="Nutrición Básica" icon={Apple} defaultOpen>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800">
              <p className="text-gray-400">Calorías</p>
              <p className="font-bold text-base">{nutricion_basica.calorias_sugeridas}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800">
              <p className="text-gray-400">Proteína (g/kg)</p>
              <p className="font-bold text-base">{nutricion_basica.proteina_g_kg}</p>
            </div>
          </div>
          {nutricion_basica.suplementos?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-400 mb-1">Suplementos sugeridos:</p>
              <div className="flex flex-wrap gap-1.5">
                {nutricion_basica.suplementos.map((s, i) => (
                  <span key={i} className="px-2 py-1 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg text-[11px]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {nutricion_basica.restricciones?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-400 mb-1">Restricciones:</p>
              {nutricion_basica.restricciones.map((r, i) => (
                <p key={i} className="text-xs text-red-500 dark:text-red-400">• {r}</p>
              ))}
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Progression */}
      {progresion && (
        <div className="card flex items-center gap-3">
          <TrendingUp size={20} className="text-brand-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">Siguiente Fase</p>
            <p className="text-xs text-gray-400">
              {progresion.criterio} (~{progresion.semanas_estimadas} semanas)
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
