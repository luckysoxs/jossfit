import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider, useAuth } from './AuthContext'
import api from '../services/api'

// La app se abre en el gym, donde la senal se cae. Antes, cualquier fallo de
// /auth/me borraba el token, asi que abrirla un segundo sin internet dejaba
// al usuario fuera y con la lista de rutinas vacia: parecia que se habian
// borrado. Solo un 401 debe cerrar la sesion.

vi.mock('../services/api', () => ({
  default: { get: vi.fn() },
}))

vi.mock('../data/accentColors', () => ({
  applyAccentColor: vi.fn(),
}))

const USUARIO = { id: 2, name: 'Josue', accent_color: 'blue' }

function Sonda() {
  const { user, loading } = useAuth()
  if (loading) return <p>cargando</p>
  return <p>sesion: {user ? user.name : 'ninguna'}</p>
}

function montar() {
  return render(
    <AuthProvider>
      <Sonda />
    </AuthProvider>
  )
}

function conSesionGuardada() {
  localStorage.setItem('token', 'tok-123')
  localStorage.setItem('user', JSON.stringify(USUARIO))
}

describe('AuthContext al abrir la app', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('conserva la sesion cuando /auth/me falla por red', async () => {
    conSesionGuardada()
    // Un fallo de red en axios no trae response.
    api.get.mockRejectedValue(new Error('Network Error'))

    montar()

    await waitFor(() => expect(screen.getByText('sesion: Josue')).toBeInTheDocument())
    expect(localStorage.getItem('token')).toBe('tok-123')
  })

  it('conserva la sesion cuando el servidor devuelve 500', async () => {
    conSesionGuardada()
    api.get.mockRejectedValue({ response: { status: 500 } })

    montar()

    await waitFor(() => expect(screen.getByText('sesion: Josue')).toBeInTheDocument())
    expect(localStorage.getItem('token')).toBe('tok-123')
  })

  it('cierra la sesion cuando el servidor devuelve 401', async () => {
    conSesionGuardada()
    api.get.mockRejectedValue({ response: { status: 401 } })

    montar()

    await waitFor(() => expect(screen.getByText('sesion: ninguna')).toBeInTheDocument())
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('refresca los datos del usuario cuando /auth/me responde', async () => {
    conSesionGuardada()
    api.get.mockResolvedValue({ data: { ...USUARIO, name: 'Josue Salazar' } })

    montar()

    await waitFor(() => expect(screen.getByText('sesion: Josue Salazar')).toBeInTheDocument())
    expect(JSON.parse(localStorage.getItem('user')).name).toBe('Josue Salazar')
  })

  it('no pregunta por el usuario si no hay sesion guardada', async () => {
    montar()

    await waitFor(() => expect(screen.getByText('sesion: ninguna')).toBeInTheDocument())
    expect(api.get).not.toHaveBeenCalled()
  })
})
