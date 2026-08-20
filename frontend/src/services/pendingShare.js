// Token del enlace que el usuario abrió pero aún no reclama.
//
// Respaldo del parámetro ?redirect=. El caso más común de todos —cliente nuevo
// que abre el enlace en el celular y se registra— pierde el redirect con
// facilidad, y sin este respaldo termina sin rutina y sin saber por qué.

const KEY = 'pending_share_token'

export function setPendingShare(token) {
  if (!token) return
  try {
    sessionStorage.setItem(KEY, token)
  } catch {
    // Modo privado de Safari puede bloquear sessionStorage. El redirect sigue.
  }
}

export function getPendingShare() {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearPendingShare() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // sin consecuencias
  }
}
