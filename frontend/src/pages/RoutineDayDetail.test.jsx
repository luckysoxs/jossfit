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

let params = { id: '1', dayId: '10' }

vi.mock('react-router-dom', () => ({
  useParams: () => params,
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

function mockApi(datos) {
  api.get.mockImplementation((url) => {
    if (url === '/routines/1') return Promise.resolve({ data: datos })
    if (url === '/workouts/progress/1') return Promise.resolve({ data: {} })
    if (url === '/workouts/today-summary') return Promise.resolve({ data: null })
    return Promise.resolve({ data: [] })
  })
  api.put.mockResolvedValue({ data: { ok: true, name: 'Empuje' } })
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
  beforeEach(() => {
    vi.clearAllMocks()
    params = { id: '1', dayId: '10' }
  })

  it('al tocar el titulo abre el campo con el nombre del dia, sin el dia de la semana', async () => {
    const boton = await montar()
    // El prefijo del dia de la semana vive solo en el titulo, no en el nombre guardado.
    expect(screen.getByRole('heading', { name: 'Lunes - Pecho' })).toBeInTheDocument()
    await userEvent.click(boton)

    const campo = screen.getByRole('textbox', { name: 'Nombre del dia' })
    expect(campo).toHaveValue('Pecho')
  })

  it('al salir del campo (blur) guarda el nombre nuevo', async () => {
    const boton = await montar()
    await userEvent.click(boton)

    const campo = screen.getByRole('textbox', { name: 'Nombre del dia' })
    await userEvent.clear(campo)
    await userEvent.type(campo, 'Empuje')
    await userEvent.tab()

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/routines/days/10', { name: 'Empuje' }))
  })

  it('si el nombre no cambia no llama al servidor y cierra el campo', async () => {
    const boton = await montar()
    await userEvent.click(boton)
    await userEvent.tab()

    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Nombre del dia' })).toBeNull())
    expect(api.put).not.toHaveBeenCalled()
  })

  it('si el guardado funciona pero la recarga falla, no muestra error y cierra el campo', async () => {
    const boton = await montar()
    await userEvent.click(boton)
    api.get.mockImplementation(() => Promise.reject(new Error('sin red')))

    const campo = screen.getByRole('textbox', { name: 'Nombre del dia' })
    await userEvent.clear(campo)
    await userEvent.type(campo, 'Empuje{Enter}')

    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Nombre del dia' })).toBeNull())
    expect(screen.queryByText('No pudimos guardar el nombre')).toBeNull()
  })

  it('al cambiar de dia el editor se cierra aunque el guardado haya fallado', async () => {
    const datos = rutina({
      days: [
        { id: 10, day_number: 1, name: 'Pecho', focus: 'chest', exercises: [] },
        { id: 11, day_number: 2, name: 'Espalda', focus: 'back', exercises: [] },
      ],
    })
    mockApi(datos)
    const { rerender } = render(<RoutineDayDetail />)
    await userEvent.click(await screen.findByRole('button', { name: /Editar el nombre del dia/i }))
    api.put.mockRejectedValue({ response: { data: { detail: 'Error del servidor' } } })

    const campo = screen.getByRole('textbox', { name: 'Nombre del dia' })
    await userEvent.clear(campo)
    await userEvent.type(campo, 'Otro{Enter}')
    expect(await screen.findByText('Error del servidor')).toBeInTheDocument()

    params = { id: '1', dayId: '11' }
    rerender(<RoutineDayDetail />)

    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Nombre del dia' })).toBeNull())
    expect(screen.queryByText('Error del servidor')).toBeNull()
    expect(screen.getByRole('button', { name: /Editar el nombre del dia/i })).toBeInTheDocument()
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

// ─── Marcar todo el dia ───

const EX_CON_HISTORIAL = {
  id: 101, exercise_id: 1, order: 1, sets: 4, reps_min: 6, reps_max: 8,
  rest_seconds: 120, notes: null, group_id: null,
  exercise: { id: 1, name: 'Bench Press', name_es: 'Press de banca', muscle_group: 'chest', category: 'compound' },
}

const EX_SIN_HISTORIAL = {
  id: 102, exercise_id: 2, order: 2, sets: 3, reps_min: 10, reps_max: 12,
  rest_seconds: 90, notes: null, group_id: null,
  exercise: { id: 2, name: 'Cable Fly', name_es: 'Cruce de poleas', muscle_group: 'chest', category: 'isolation' },
}

function rutinaConEjercicios(extra = {}) {
  return {
    ...rutina(),
    days: [{ id: 10, day_number: 1, name: 'Pecho', focus: 'chest', exercises: [EX_CON_HISTORIAL, EX_SIN_HISTORIAL] }],
    ...extra,
  }
}

function mockApiConUltimas(datos, ultimas, progreso = {}) {
  api.get.mockImplementation((url) => {
    if (url === '/routines/1') return Promise.resolve({ data: datos })
    if (url === '/workouts/last-sets') return Promise.resolve({ data: ultimas })
    if (url === '/workouts/progress/1') return Promise.resolve({ data: progreso })
    if (url === '/workouts/today-summary') return Promise.resolve({ data: null })
    return Promise.resolve({ data: [] })
  })
  api.post.mockResolvedValue({ data: { ok: true, saved: 2, workout_id: 9 } })
}

function montarConEjercicios(datos = rutinaConEjercicios(), ultimas = [{ exercise_id: 1, weight_kg: 80, reps: 7 }]) {
  mockApiConUltimas(datos, ultimas)
  render(<RoutineDayDetail />)
  return screen.findByRole('button', { name: /Marcar todo el dia/i })
}

describe('RoutineDayDetail - marcar todo el dia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    params = { id: '1', dayId: '10' }
    // El progreso marcado vive en localStorage y persiste entre pruebas del
    // mismo archivo: sin esto, el caso que confirma deja todo marcado y los
    // siguientes arrancan sin pendientes.
    localStorage.clear()
  })

  it('el resumen trae el peso y las reps de la ultima vez', async () => {
    const boton = await montarConEjercicios()
    await userEvent.click(boton)

    const fila = screen.getByTestId('bulk-row-101')
    expect(fila).toHaveTextContent('80')
    expect(fila).toHaveTextContent('7')
  })

  it('un ejercicio sin historial sale marcado y con el peso en 0', async () => {
    const boton = await montarConEjercicios()
    await userEvent.click(boton)

    const fila = screen.getByTestId('bulk-row-102')
    expect(fila).toHaveTextContent(/sin historial/i)
    expect(screen.getByLabelText('Peso de Cruce de poleas')).toHaveValue(0)
    expect(fila).toHaveTextContent('10')
  })

  it('confirmar manda una sola peticion con todas las series', async () => {
    const boton = await montarConEjercicios()
    await userEvent.click(boton)
    await userEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    expect(api.post).toHaveBeenCalledWith('/workouts/bulk-sets', {
      sets: [
        { exercise_id: 1, weight_kg: 80, reps: 7 },
        { exercise_id: 2, weight_kg: 0, reps: 10 },
      ],
    })
  })

  it('el peso que teclees para uno sin historial es el que se manda', async () => {
    const boton = await montarConEjercicios()
    await userEvent.click(boton)

    const campo = screen.getByLabelText('Peso de Cruce de poleas')
    await userEvent.clear(campo)
    await userEvent.type(campo, '25')
    await userEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/workouts/bulk-sets', {
      sets: [
        { exercise_id: 1, weight_kg: 80, reps: 7 },
        { exercise_id: 2, weight_kg: 25, reps: 10 },
      ],
    }))
  })

  it('cancelar no llama al servidor', async () => {
    const boton = await montarConEjercicios()
    await userEvent.click(boton)
    await userEvent.click(screen.getByRole('button', { name: /Cancelar/i }))

    expect(screen.queryByTestId('bulk-row-101')).toBeNull()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('el boton no aparece en una rutina de coach', async () => {
    mockApiConUltimas(rutinaConEjercicios({ read_only: true }), [])
    render(<RoutineDayDetail />)

    expect(await screen.findByRole('heading', { name: 'Lunes - Pecho' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Marcar todo el dia/i })).toBeNull()
  })

  it('el boton no aparece si ya no hay pendientes', async () => {
    mockApiConUltimas(rutinaConEjercicios(), [], { 101: true, 102: true })
    render(<RoutineDayDetail />)

    expect(await screen.findByRole('heading', { name: 'Lunes - Pecho' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: /Marcar todo el dia/i })).toBeNull())
  })
})
