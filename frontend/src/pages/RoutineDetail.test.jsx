import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import RoutineDetail from './RoutineDetail'
import api from '../services/api'

// Reordenar dias se hacia arrastrando con el dedo y en iPhone no movia nada:
// el gesto se cortaba a media interaccion. Ahora son flechas, como los
// ejercicios de un dia, y esto fija ese comportamiento.

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), put: vi.fn() },
}))

vi.mock('../services/offlineCache', () => ({
  cacheSet: vi.fn(),
  cacheGet: vi.fn(() => null),
}))

vi.mock('../hooks/useOnlineStatus', () => ({ default: () => true }))

let usuario = { id: 1, is_coach: false, is_admin: false, coach_blocked: false }

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: usuario }),
}))

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: '1' }),
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }) => <a {...props}>{children}</a>,
}))

// Lunes, martes y miercoles; descansa domingo.
const RUTINA = {
  id: 1,
  name: 'Rutina de prueba',
  split_type: 'upper_lower',
  days_per_week: 3,
  rest_weekdays: [6],
  is_template: false,
  read_only: false,
  generation_type: 'normal',
  ai_data: null,
  days: [
    { id: 10, day_number: 1, name: 'Pecho', focus: 'chest', exercises: [] },
    { id: 20, day_number: 2, name: 'Pierna', focus: 'quadriceps', exercises: [] },
    { id: 30, day_number: 3, name: 'Espalda', focus: 'back', exercises: [] },
  ],
}

function montar() {
  api.get.mockImplementation((url) => {
    if (url === '/routines/1') return Promise.resolve({ data: RUTINA })
    return Promise.resolve({ data: {} })
  })
  api.put.mockResolvedValue({ data: { ok: true } })
  render(<RoutineDetail />)
  return screen.findByText(/Pecho/)
}

describe('RoutineDetail - reordenar dias', () => {
  beforeEach(() => vi.clearAllMocks())

  it('bajar un dia manda el orden nuevo al servidor', async () => {
    await montar()

    await userEvent.click(screen.getByRole('button', { name: 'Bajar Pecho' }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/routines/reorder-days',
      { routine_id: 1, day_order: [20, 10, 30] },
    ))
  })

  it('subir un dia manda el orden nuevo al servidor', async () => {
    await montar()

    await userEvent.click(screen.getByRole('button', { name: 'Subir Espalda' }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/routines/reorder-days',
      { routine_id: 1, day_order: [10, 30, 20] },
    ))
  })

  it('el primer dia no se puede subir y el ultimo no se puede bajar', async () => {
    await montar()

    expect(screen.getByRole('button', { name: 'Subir Pecho' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bajar Espalda' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bajar Pecho' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Subir Espalda' })).toBeEnabled()
  })

  it('recarga la rutina despues de reordenar', async () => {
    await montar()

    await userEvent.click(screen.getByRole('button', { name: 'Bajar Pecho' }))

    // La carga inicial ya pidio la rutina; tras reordenar la vuelve a pedir.
    await waitFor(() => {
      const pedidos = api.get.mock.calls.filter(([url]) => url === '/routines/1')
      expect(pedidos.length).toBeGreaterThanOrEqual(2)
    })
  })
})

describe('RoutineDetail - compartir con clientes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usuario = { id: 1, is_coach: false, is_admin: false, coach_blocked: false }
  })

  it('un usuario normal puede compartir con clientes', async () => {
    await montar()
    expect(await screen.findByRole('button', { name: /Compartir con clientes/i })).toBeInTheDocument()
  })

  it('un usuario bloqueado no ve el boton', async () => {
    usuario = { id: 1, is_coach: false, is_admin: false, coach_blocked: true }
    await montar()

    expect(await screen.findByText(/Pecho/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Compartir con clientes/i })).toBeNull()
  })

  it('un admin bloqueado si lo ve', async () => {
    usuario = { id: 1, is_coach: false, is_admin: true, coach_blocked: true }
    await montar()
    expect(await screen.findByRole('button', { name: /Compartir con clientes/i })).toBeInTheDocument()
  })
})
