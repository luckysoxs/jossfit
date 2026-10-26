import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Routines from './Routines'
import api from '../services/api'
import { cacheGet } from '../services/offlineCache'

// Cuando la lista fallaba al cargar y no habia nada en cache, la pantalla
// decia "No tienes rutinas creadas". Es mentira y asusta: parece que se
// borraron. Un fallo tiene que verse como fallo, con boton de reintentar.

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

vi.mock('../services/offlineCache', () => ({
  cacheSet: vi.fn(),
  cacheGet: vi.fn(() => null),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}))

vi.mock('../components/ui/PageTour', () => ({ default: () => null }))

const RUTINA = {
  id: 61,
  name: '6 Dias - Jos PPL',
  objective: 'hypertrophy',
  days_per_week: 6,
  days: [{ id: 1, exercises: [{ id: 1 }, { id: 2 }] }],
}

describe('Mis Rutinas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cacheGet.mockReturnValue(null)
    localStorage.clear()
  })

  it('muestra las rutinas que llegan', async () => {
    api.get.mockResolvedValue({ data: [RUTINA] })

    render(<Routines />)

    expect(await screen.findByText('6 Dias - Jos PPL')).toBeInTheDocument()
  })

  it('dice que no hay rutinas solo cuando el servidor contesta que no hay', async () => {
    api.get.mockResolvedValue({ data: [] })

    render(<Routines />)

    expect(await screen.findByText('No tienes rutinas creadas')).toBeInTheDocument()
  })

  it('avisa que no pudo cargar cuando falla y no hay cache', async () => {
    api.get.mockRejectedValue(new Error('Network Error'))

    render(<Routines />)

    expect(await screen.findByText(/no se pudieron cargar/i)).toBeInTheDocument()
    expect(screen.queryByText('No tienes rutinas creadas')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument()
  })

  it('reintenta y muestra las rutinas cuando el segundo intento funciona', async () => {
    api.get.mockRejectedValueOnce(new Error('Network Error'))
    api.get.mockResolvedValueOnce({ data: [RUTINA] })

    render(<Routines />)

    const boton = await screen.findByRole('button', { name: /reintentar/i })
    await userEvent.click(boton)

    expect(await screen.findByText('6 Dias - Jos PPL')).toBeInTheDocument()
    expect(screen.queryByText(/no se pudieron cargar/i)).not.toBeInTheDocument()
  })

  it('usa el cache cuando falla, sin mostrar el aviso de error', async () => {
    api.get.mockRejectedValue(new Error('Network Error'))
    cacheGet.mockReturnValue([RUTINA])

    render(<Routines />)

    expect(await screen.findByText('6 Dias - Jos PPL')).toBeInTheDocument()
    expect(screen.queryByText(/no se pudieron cargar/i)).not.toBeInTheDocument()
  })
})
