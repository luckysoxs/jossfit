import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DuplicateRoutineModal from './DuplicateRoutineModal'
import api from '../../services/api'

vi.mock('../../services/api', () => ({
  default: { post: vi.fn() },
}))

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}))

const RUTINA = { id: 7, name: 'Pierna' }

function montar(props = {}) {
  const onClose = vi.fn()
  render(
    <DuplicateRoutineModal routine={RUTINA} destino="cliente"
      title="Duplicar para clientes" onClose={onClose} {...props} />,
  )
  return { onClose }
}

describe('DuplicateRoutineModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('prellena el nombre con "(copia)"', () => {
    montar()
    expect(screen.getByRole('textbox')).toHaveValue('Pierna (copia)')
  })

  it('manda destino y nombre, y lleva a la copia', async () => {
    api.post.mockResolvedValue({ data: { id: 42 } })
    const { onClose } = montar()
    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'Para Ana')
    await userEvent.click(screen.getByRole('button', { name: /duplicar/i }))

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/routines/42'))
    expect(api.post).toHaveBeenCalledWith('/routines/7/duplicate',
      { destino: 'cliente', name: 'Para Ana' })
    expect(onClose).toHaveBeenCalled()
  })

  it('nombre vacio manda null', async () => {
    api.post.mockResolvedValue({ data: { id: 43 } })
    montar({ destino: 'mia' })
    await userEvent.clear(screen.getByRole('textbox'))
    await userEvent.click(screen.getByRole('button', { name: /duplicar/i }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/routines/7/duplicate',
      { destino: 'mia', name: null }))
  })

  it('muestra el error del servidor y no navega', async () => {
    api.post.mockRejectedValue({ response: { data: { detail: 'Necesitas ser coach' } } })
    const { onClose } = montar()
    await userEvent.click(screen.getByRole('button', { name: /duplicar/i }))
    expect(await screen.findByText('Necesitas ser coach')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
