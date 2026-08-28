import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ExercisePickerModal from './ExercisePickerModal'
import api from '../../services/api'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('../../services/offlineCache', () => ({
  cacheSet: vi.fn(),
  cacheGet: vi.fn(() => null),
}))

// Misma distribucion que el seed real: 204 ejercicios en 13 grupos.
const DISTRIBUCION = {
  back: 25, chest: 22, shoulders: 22, quadriceps: 19, abs: 19, biceps: 18,
  triceps: 16, hamstrings: 14, glutes: 14, cardio: 13, calves: 8,
  forearms: 8, traps: 6,
}

function construirEjercicios() {
  const out = []
  let id = 1
  for (const [grupo, cantidad] of Object.entries(DISTRIBUCION)) {
    for (let n = 0; n < cantidad; n++) {
      out.push({
        id: id++,
        name: `${grupo} exercise ${n}`,
        name_es: `${grupo} ejercicio ${n}`,
        muscle_group: grupo,
        category: grupo === 'cardio' ? 'cardio' : (n % 2 ? 'compound' : 'isolation'),
        equipment: 'Barbell',
      })
    }
  }
  return out
}

const EJERCICIOS = construirEjercicios()

// Techo de items renderizados a la vez. Con 204 de golpe (829 nodos DOM) la
// interfaz se congela en movil: cada tecla obliga a React a reconciliarlos
// todos. El JS de filtrado es despreciable (0.03 ms medidos) — el costo es
// el volumen renderizado, asi que esto es lo que hay que acotar.
const MAX_ITEMS_RENDERIZADOS = 40

function contarOpciones() {
  const lista = screen.getByTestId('lista-ejercicios')
  return within(lista).queryAllByRole('button', { name: /ejercicio|cardio/i }).length
}

describe('ExercisePickerModal - volumen de renderizado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: EJERCICIOS })
  })

  it('no renderiza los 204 ejercicios al abrirse', async () => {
    render(<ExercisePickerModal title="Agregar ejercicio" onClose={vi.fn()} onSelect={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('lista-ejercicios')).toBeInTheDocument())

    expect(contarOpciones()).toBeLessThanOrEqual(MAX_ITEMS_RENDERIZADOS)
  })

  it('mantiene el techo mientras se escribe en el buscador', async () => {
    const user = userEvent.setup()
    render(<ExercisePickerModal title="Agregar ejercicio" onClose={vi.fn()} onSelect={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('lista-ejercicios')).toBeInTheDocument())

    const buscador = screen.getByPlaceholderText(/buscar/i)
    // "e" hace match con practicamente todos los 204: el peor caso.
    await user.type(buscador, 'e')

    await waitFor(() => {
      expect(contarOpciones()).toBeLessThanOrEqual(MAX_ITEMS_RENDERIZADOS)
    })
  })

  it('empieza en el musculo del dia cuando se le pasa priorityMuscle', async () => {
    render(
      <ExercisePickerModal title="Agregar" priorityMuscle="chest"
        onClose={vi.fn()} onSelect={vi.fn()} />
    )
    await waitFor(() => expect(screen.getByTestId('lista-ejercicios')).toBeInTheDocument())

    const lista = screen.getByTestId('lista-ejercicios')
    // Todo lo listado debe ser de pecho, no una mezcla de los 13 grupos.
    expect(within(lista).queryAllByText(/chest ejercicio/i).length).toBeGreaterThan(0)
    expect(within(lista).queryAllByText(/back ejercicio/i).length).toBe(0)
  })

  it('la busqueda cruza todos los grupos, no solo el chip activo', async () => {
    const user = userEvent.setup()
    render(
      <ExercisePickerModal title="Agregar" priorityMuscle="chest"
        onClose={vi.fn()} onSelect={vi.fn()} />
    )
    await waitFor(() => expect(screen.getByTestId('lista-ejercicios')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText(/buscar/i), 'back ejercicio 3')

    await waitFor(() => {
      const lista = screen.getByTestId('lista-ejercicios')
      expect(within(lista).queryAllByText(/back ejercicio 3/i).length).toBeGreaterThan(0)
    })
  })

  it('sigue pudiendo seleccionar un ejercicio', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <ExercisePickerModal title="Agregar" priorityMuscle="chest"
        onClose={vi.fn()} onSelect={onSelect} />
    )
    await waitFor(() => expect(screen.getByTestId('lista-ejercicios')).toBeInTheDocument())

    await user.click(screen.getByText('chest ejercicio 0'))

    await waitFor(() => expect(onSelect).toHaveBeenCalled())
    expect(onSelect.mock.calls[0][0].name).toBe('chest exercise 0')
  })
})
