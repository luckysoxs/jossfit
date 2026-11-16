import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ExerciseProgressChart from './ExerciseProgressChart'
import api from '../../services/api'

// La grafica de progreso de un ejercicio. Las tres metricas viajan juntas en
// la misma respuesta, asi que cambiar de metrica no debe volver al servidor;
// cambiar de rango si.

vi.mock('../../services/api', () => ({
  default: { get: vi.fn() },
}))

vi.mock('../../contexts/WeightUnitContext', () => ({
  useWeightUnit: () => ({ unit: 'kg', displayWeight: (kg) => kg }),
}))

const HISTORIAL = {
  exercise_id: 7,
  exercise_name: 'Press banca',
  points: [
    {
      date: '2026-10-01',
      max_weight: 80, volume: 1600, est_1rm: 93.3, total_reps: 20,
      sets: [{ reps: 10, weight_kg: 80 }, { reps: 10, weight_kg: 80 }],
    },
    {
      date: '2026-11-10',
      max_weight: 100, volume: 2020, est_1rm: 114.6, total_reps: 23,
      sets: [{ reps: 5, weight_kg: 100 }, { reps: 8, weight_kg: 90 }],
    },
  ],
}

function montar() {
  return render(<ExerciseProgressChart exerciseId={7} exerciseName="Press banca" />)
}

function paramsDeLaLlamada(i) {
  return api.get.mock.calls[i][1]?.params || {}
}

describe('ExerciseProgressChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: HISTORIAL })
  })

  it('arranca en 30 dias', async () => {
    montar()
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(api.get.mock.calls[0][0]).toBe('/workouts/exercise-history/7')
    expect(paramsDeLaLlamada(0).days).toBe(30)
  })

  it('muestra que se cargo el ultimo dia, con sus reps', async () => {
    montar()
    expect(await screen.findByText(/100 kg × 5/)).toBeInTheDocument()
    expect(screen.getByText(/90 kg × 8/)).toBeInTheDocument()
  })

  it('cambiar de rango vuelve a pedir con el nuevo tope', async () => {
    montar()
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button', { name: '1 año' }))

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    expect(paramsDeLaLlamada(1).days).toBe(365)
  })

  it('el rango Todo pide sin tope', async () => {
    montar()
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button', { name: 'Todo' }))

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    expect(paramsDeLaLlamada(1).days).toBeUndefined()
  })

  it('cambiar de metrica no vuelve al servidor', async () => {
    montar()
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button', { name: 'Volumen' }))
    await userEvent.click(screen.getByRole('button', { name: '1RM' }))

    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('avisa cuando no hay nada en el rango', async () => {
    api.get.mockResolvedValue({ data: { ...HISTORIAL, points: [] } })
    montar()
    expect(await screen.findByText(/sin registros en este rango/i)).toBeInTheDocument()
  })

  it('avisa cuando no se pudo cargar, sin fingir que no hay datos', async () => {
    api.get.mockRejectedValue(new Error('Network Error'))
    montar()
    expect(await screen.findByText(/no se pudo cargar/i)).toBeInTheDocument()
    expect(screen.queryByText(/sin registros en este rango/i)).not.toBeInTheDocument()
  })
})
