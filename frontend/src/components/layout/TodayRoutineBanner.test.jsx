import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TodayRoutineBanner from './TodayRoutineBanner'
import api from '../../services/api'
import { progressStorageKey } from '../../utils/routineConstants'

// El banner tomaba routines[length - 1] y la lista llega ordenada de la mas
// nueva a la mas vieja: mandaba al dia de la rutina MAS VIEJA. Tiene que
// seguir la bandera de rutina activa.

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }))

vi.mock('../../services/offlineCache', () => ({
  cacheSet: vi.fn(),
  cacheGet: vi.fn(() => null),
}))

const { navegar, ubicacion } = vi.hoisted(() => ({
  navegar: vi.fn(),
  ubicacion: { pathname: '/dashboard' },
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => navegar,
  useLocation: () => ubicacion,
}))

// Estos objetos tienen que ser SIEMPRE el mismo: el efecto que carga la
// rutina depende de `user`, y devolver uno nuevo en cada render lo vuelve un
// ciclo infinito que cuelga la prueba.
vi.mock('../../contexts/AuthContext', () => {
  const sesion = { user: { id: 2, name: 'Jos' } }
  return { useAuth: () => sesion }
})

vi.mock('../../contexts/RestTimerContext', () => {
  const descanso = { isRunning: false, timeLeft: 0, progress: 0 }
  return { useRestTimer: () => descanso }
})

// Sin dias de descanso, el dia N de la rutina cae en el dia N de la semana.
// Asi la prueba sirve cualquier dia que se corra, sin falsear el reloj: con
// timers falsos, findByText se rinde antes de que cargue la rutina.
const HOY = ((new Date().getDay() + 6) % 7) + 1

const semana = (prefijo, base) =>
  [1, 2, 3, 4, 5, 6, 7].map((n) => ({
    id: base + n,
    day_number: n,
    name: `${prefijo} dia ${n}`,
    exercises: [{ id: base + n }],
  }))

const VIEJA = {
  id: 61,
  name: '6 Dias - Jos PPL',
  created_at: '2025-08-01T00:00:00',
  days_per_week: 7,
  rest_weekdays: [],
  is_active: false,
  days: semana('Vieja', 100),
}

const NUEVA = {
  id: 66,
  name: 'Rutina 6 dias',
  created_at: '2026-11-15T00:00:00',
  days_per_week: 7,
  rest_weekdays: [],
  is_active: true,
  days: semana('Nueva', 200),
}

describe('Banner de hoy te toca', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    ubicacion.pathname = '/dashboard'
  })

  it('muestra el dia de la rutina activa, no el de la mas vieja', async () => {
    // Como las manda el backend: de la mas nueva a la mas vieja.
    api.get.mockResolvedValue({ data: [NUEVA, VIEJA] })

    render(<TodayRoutineBanner />)

    expect(await screen.findByText(`Nueva dia ${HOY}`)).toBeInTheDocument()
    expect(screen.queryByText(`Vieja dia ${HOY}`)).not.toBeInTheDocument()
  })

  it('lleva al dia de la rutina activa al tocarlo', async () => {
    api.get.mockResolvedValue({ data: [NUEVA, VIEJA] })

    render(<TodayRoutineBanner />)
    const boton = await screen.findByRole('button')
    boton.click()

    expect(navegar).toHaveBeenCalledWith(`/routines/66/day/${200 + HOY}`)
  })

  it('sin ninguna activa usa la propia mas reciente', async () => {
    api.get.mockResolvedValue({ data: [{ ...NUEVA, is_active: false }, VIEJA] })

    render(<TodayRoutineBanner />)

    expect(await screen.findByText(`Nueva dia ${HOY}`)).toBeInTheDocument()
  })

  it('prefiere la propia sobre una asignada mas nueva si ninguna esta activa', async () => {
    const delCoach = {
      ...VIEJA, id: 70, name: 'Plan del coach', created_at: '2026-11-16T00:00:00',
      read_only: true, days: semana('Coach', 300),
    }
    api.get.mockResolvedValue({ data: [delCoach, { ...NUEVA, is_active: false }] })

    render(<TodayRoutineBanner />)

    expect(await screen.findByText(`Nueva dia ${HOY}`)).toBeInTheDocument()
  })

  it('usa la asignada cuando el usuario no tiene rutinas propias', async () => {
    const delCoach = { ...VIEJA, id: 70, read_only: true, days: semana('Coach', 300) }
    api.get.mockResolvedValue({ data: [delCoach] })

    render(<TodayRoutineBanner />)

    expect(await screen.findByText(`Coach dia ${HOY}`)).toBeInTheDocument()
  })

  // Jos borro tres ejercicios del dia y los siete que quedaban estaban
  // marcados: el dia iba al 100%, pero el banner seguia con la lista vieja de
  // diez y decia 70%. Tiene que volver a preguntar al salir de la rutina.
  const conEjercicios = (cuantos) => ({
    ...NUEVA,
    days: [{
      id: 500,
      day_number: HOY,
      name: 'Dia de hoy',
      exercises: Array.from({ length: cuantos }, (_, i) => ({ id: 600 + i })),
    }],
    days_per_week: 7,
    rest_weekdays: [],
  })

  it('vuelve a pedir la rutina al salir de una pantalla de rutina', async () => {
    api.get.mockResolvedValue({ data: [NUEVA] })
    ubicacion.pathname = '/routines/66'

    const { rerender } = render(<TodayRoutineBanner />)
    await screen.findByText(`Nueva dia ${HOY}`)
    expect(api.get).toHaveBeenCalledTimes(1)

    ubicacion.pathname = '/dashboard'
    rerender(<TodayRoutineBanner />)

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
  })

  it('el avance usa los ejercicios que quedan, no los borrados', async () => {
    // Siete marcados. Con diez ejercicios eso es 70%; con los siete que
    // quedan despues de borrar, es el dia completo.
    const marcados = {}
    for (let i = 0; i < 7; i++) marcados[600 + i] = true
    localStorage.setItem(progressStorageKey(66), JSON.stringify(marcados))

    api.get.mockResolvedValue({ data: [conEjercicios(10)] })
    ubicacion.pathname = '/routines/66'
    const { rerender } = render(<TodayRoutineBanner />)
    expect(await screen.findByText('70%')).toBeInTheDocument()

    api.get.mockResolvedValue({ data: [conEjercicios(7)] })
    ubicacion.pathname = '/dashboard'
    rerender(<TodayRoutineBanner />)

    expect(await screen.findByText('100%')).toBeInTheDocument()
    expect(screen.queryByText('70%')).not.toBeInTheDocument()
  })

  it('no se muestra si no hay rutinas', async () => {
    api.get.mockResolvedValue({ data: [] })

    const { container } = render(<TodayRoutineBanner />)

    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
