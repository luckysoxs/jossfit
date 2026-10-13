import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import RoutineDayDetail from './RoutineDayDetail'
import api from '../services/api'

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

vi.mock('../services/offlineCache', () => ({
  cacheSet: vi.fn(),
  cacheGet: vi.fn(() => null),
  queueAction: vi.fn(),
}))

vi.mock('../hooks/useOnlineStatus', () => ({ default: () => true }))

vi.mock('../contexts/RestTimerContext', () => ({
  useRestTimer: () => ({
    timeLeft: 0, totalSeconds: 0, isRunning: false, progress: 0,
    startTimer: vi.fn(), stopTimer: vi.fn(),
  }),
}))

vi.mock('../contexts/WeightUnitContext', () => ({
  useWeightUnit: () => ({ unit: 'kg', displayWeight: (kg) => kg, toKg: (v) => v }),
}))

vi.mock('../components/ui/PageTour', () => ({ default: () => null }))

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: '1', dayId: '10' }),
  useNavigate: () => vi.fn(),
}))

function rutina(extra = {}) {
  return {
    id: 1,
    name: 'Rutina',
    split_type: 'full_body',
    days_per_week: 1,
    rest_weekdays: [6],
    generation_type: 'normal',
    ai_data: null,
    read_only: false,
    days: [{ id: 10, day_number: 1, name: 'Pecho', focus: 'chest', exercises: [] }],
    ...extra,
  }
}

function montar(datos = rutina()) {
  api.get.mockImplementation((url) => {
    if (url === '/routines/1') return Promise.resolve({ data: datos })
    if (url === '/workouts/progress/1') return Promise.resolve({ data: {} })
    if (url === '/workouts/today-summary') return Promise.resolve({ data: null })
    return Promise.resolve({ data: [] })
  })
  api.put.mockResolvedValue({ data: { ok: true, name: 'Empuje' } })
  render(<RoutineDayDetail />)
  return screen.findByRole('button', { name: /Editar el nombre del dia/i })
}

describe('RoutineDayDetail - nombre del dia', () => {
  beforeEach(() => vi.clearAllMocks())

  it('al tocar el titulo abre el campo con el nombre del dia, sin el dia de la semana', async () => {
    const boton = await montar()
    await userEvent.click(boton)

    const campo = screen.getByRole('textbox', { name: 'Nombre del dia' })
    expect(campo).toHaveValue('Pecho')
  })

  it('Enter guarda el nombre nuevo y recarga la rutina', async () => {
    const boton = await montar()
    await userEvent.click(boton)

    const campo = screen.getByRole('textbox', { name: 'Nombre del dia' })
    await userEvent.clear(campo)
    await userEvent.type(campo, 'Empuje{Enter}')

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/routines/days/10', { name: 'Empuje' }))
    await waitFor(() => {
      const pedidos = api.get.mock.calls.filter(([url]) => url === '/routines/1')
      expect(pedidos.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('Escape cierra el campo sin llamar al servidor', async () => {
    const boton = await montar()
    await userEvent.click(boton)

    const campo = screen.getByRole('textbox', { name: 'Nombre del dia' })
    await userEvent.clear(campo)
    await userEvent.type(campo, 'Otro{Escape}')

    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Nombre del dia' })).toBeNull())
    expect(api.put).not.toHaveBeenCalled()
  })

  it('muestra el error del servidor y deja el campo abierto', async () => {
    const boton = await montar()
    api.put.mockRejectedValue({
      response: { data: { detail: 'El dia de la semana se pone solo; escribe solo el nombre' } },
    })
    await userEvent.click(boton)

    const campo = screen.getByRole('textbox', { name: 'Nombre del dia' })
    await userEvent.clear(campo)
    await userEvent.type(campo, 'Lunes - Pecho{Enter}')

    expect(await screen.findByText('El dia de la semana se pone solo; escribe solo el nombre')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Nombre del dia' })).toBeInTheDocument()
  })

  it('en una rutina de coach no hay boton para editar el titulo', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/routines/1') return Promise.resolve({ data: rutina({ read_only: true }) })
      if (url === '/workouts/progress/1') return Promise.resolve({ data: {} })
      if (url === '/workouts/today-summary') return Promise.resolve({ data: null })
      return Promise.resolve({ data: [] })
    })
    render(<RoutineDayDetail />)

    expect(await screen.findByRole('heading', { name: /Pecho/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar el nombre del dia/i })).toBeNull()
  })
})
