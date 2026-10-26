import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import RoutineDayDetail from './RoutineDayDetail'
import api from '../services/api'
import { queueAction } from '../services/offlineCache'

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

vi.mock('../services/offlineCache', () => ({
  cacheSet: vi.fn(),
  cacheGet: vi.fn(() => null),
  queueAction: vi.fn(),
}))

let online = true

vi.mock('../hooks/useOnlineStatus', () => ({ default: () => online }))

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
    online = true
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
    const [url, cuerpo] = api.post.mock.calls[0]
    expect(url).toBe('/workouts/bulk-sets')
    expect(cuerpo.sets).toEqual([
      { exercise_id: 1, weight_kg: 80, reps: 7 },
      { exercise_id: 2, weight_kg: 0, reps: 10 },
    ])
    expect(cuerpo.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Sin esto el entreno no queda ligado a la rutina y la adherencia que ve
    // un coach no se puede acotar a lo que el dio.
    expect(cuerpo.routine_day_id).toBe(10)
  })

  it('el peso que teclees para uno sin historial es el que se manda', async () => {
    const boton = await montarConEjercicios()
    await userEvent.click(boton)

    const campo = screen.getByLabelText('Peso de Cruce de poleas')
    await userEvent.clear(campo)
    await userEvent.type(campo, '25')
    await userEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    expect(api.post.mock.calls[0][1].sets).toEqual([
      { exercise_id: 1, weight_kg: 80, reps: 7 },
      { exercise_id: 2, weight_kg: 25, reps: 10 },
    ])
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
  it('sin internet encola la accion con la fecha y marca los ejercicios', async () => {
    online = false
    const boton = await montarConEjercicios()
    await userEvent.click(boton)
    await userEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    await waitFor(() => expect(queueAction).toHaveBeenCalledTimes(1))
    expect(api.post).not.toHaveBeenCalled()

    const encolado = queueAction.mock.calls[0][0]
    expect(encolado.method).toBe('post')
    expect(encolado.url).toBe('/workouts/bulk-sets')
    expect(encolado.data.sets).toHaveLength(2)
    // La fecha viaja en el cuerpo para que al reenviarse no caiga en otro dia.
    const hoy = new Date()
    const esperada = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
    expect(encolado.data.date).toBe(esperada)

    // El modal se cierra y los ejercicios quedan marcados.
    await waitFor(() => expect(screen.queryByTestId('bulk-row-101')).toBeNull())
    await waitFor(() => expect(screen.queryByRole('button', { name: /Marcar todo el dia/i })).toBeNull())
  })

  it('si el servidor rechaza, muestra el error y no marca ni encola nada', async () => {
    const boton = await montarConEjercicios()
    api.post.mockRejectedValue({
      response: { status: 400, data: { detail: 'Ejercicio invalido' } },
    })
    await userEvent.click(boton)
    await userEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    expect(await screen.findByText('Ejercicio invalido')).toBeInTheDocument()
    expect(queueAction).not.toHaveBeenCalled()
    // El modal sigue abierto y nada quedo marcado.
    expect(screen.getByTestId('bulk-row-101')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirmar/i })).toBeEnabled()
  })

  it('si el servidor falla (500) si encola, porque reintentar tiene sentido', async () => {
    const boton = await montarConEjercicios()
    api.post.mockRejectedValue({ response: { status: 500, data: {} } })
    await userEvent.click(boton)
    await userEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    await waitFor(() => expect(queueAction).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByTestId('bulk-row-101')).toBeNull())
  })

  it('un peso invalido no se manda como 0', async () => {
    const boton = await montarConEjercicios()
    await userEvent.click(boton)

    const campo = screen.getByLabelText('Peso de Cruce de poleas')
    await userEvent.clear(campo)
    await userEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    expect(await screen.findByText(/Revisa el peso de Cruce de poleas/)).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })
  it('al guardar bien, el progreso queda persistido en localStorage', async () => {
    const boton = await montarConEjercicios()
    await userEvent.click(boton)
    await userEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    await waitFor(() => {
      const guardado = Object.entries(localStorage)
        .filter(([k]) => k.includes('progress') || k.includes('routine'))
        .map(([, v]) => v)
        .join('')
      expect(guardado).toContain('101')
      expect(guardado).toContain('102')
    })
  })

  it('un rechazo del servidor no deja nada marcado', async () => {
    const boton = await montarConEjercicios()
    api.post.mockRejectedValue({
      response: { status: 400, data: { detail: 'Ejercicio invalido' } },
    })
    await userEvent.click(boton)
    await userEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    expect(await screen.findByText('Ejercicio invalido')).toBeInTheDocument()
    // Ni en localStorage ni en la pantalla: el boton de marcar sigue ahi.
    const guardado = Object.values(localStorage).join('')
    expect(guardado).not.toContain('101')
    await userEvent.click(screen.getByRole('button', { name: /Cancelar/i }))
    expect(screen.getByRole('button', { name: /Marcar todo el dia/i })).toBeInTheDocument()
  })
})
