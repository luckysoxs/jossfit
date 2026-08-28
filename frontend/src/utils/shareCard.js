// Tarjetas compartibles (PR y entreno completado), dibujadas en Canvas 2D.
//
// Se dibuja a mano en vez de rasterizar el DOM (html2canvas y similares) por
// tres razones: no mete dependencias nuevas, el PNG sale identico en todos los
// navegadores, y funciona offline igual que el resto de la app.
//
// Formato 1080x1920 (9:16), historia de Instagram.
//
// El diseno es deliberadamente minimo: un rotulo, el dato grande y nada mas.
// Todo el contenido va apilado en el tercio inferior por dos razones: es la
// zona que Instagram no tapa con su interfaz, y deja la parte de arriba limpia
// para que se vea la foto de fondo.

export const CARD_W = 1080
export const CARD_H = 1920

const MARGIN = 96
const CONTENT_W = CARD_W - MARGIN * 2
// Instagram encima la caja de respuesta abajo. 250px es el margen que la propia
// guia de historias recomienda: todo el bloque se apoya en esa linea.
const SAFE_BOTTOM = CARD_H - 250

const FONT = 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif'
const INK = '#ffffff'
const MUTED = 'rgba(255,255,255,0.52)'

/** Cuenta de Instagram, impresa en la tarjeta y sugerida al compartir. */
export const HANDLE = '@jos.sfit'

const font = (weight, size, tracking = 0) => ({
  css: `${weight} ${size}px ${FONT}`,
  size,
  tracking,
})

// ─── helpers de dibujo ───

/** Texto con tracking manual: canvas no expone letter-spacing en Safari. */
function trackedText(ctx, text, x, y, { css, tracking }, align = 'left') {
  ctx.font = css
  if (!tracking) {
    ctx.textAlign = align
    ctx.fillText(text, x, y)
    return ctx.measureText(text).width
  }
  const chars = [...text]
  const width = chars.reduce((w, c) => w + ctx.measureText(c).width, 0) + tracking * (chars.length - 1)
  let cursor = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x
  ctx.textAlign = 'left'
  for (const c of chars) {
    ctx.fillText(c, cursor, y)
    cursor += ctx.measureText(c).width + tracking
  }
  return width
}

/** Baja el tamano de fuente hasta que el texto quepa en maxWidth. */
function fitFont(ctx, text, maxWidth, weight, startSize, minSize = 24, tracking = 0) {
  let size = startSize
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${FONT}`
    const extra = tracking * Math.max(0, [...text].length - 1)
    if (ctx.measureText(text).width + extra <= maxWidth) break
    size -= 2
  }
  return font(weight, size, tracking)
}

/** Parte el texto en como mucho maxLines lineas; la ultima se recorta con "…". */
function wrapLines(ctx, text, maxWidth, cssFont, maxLines = 2) {
  ctx.font = cssFont
  const words = text.split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  let overflow = false
  for (let i = 0; i < words.length; i++) {
    const candidate = line ? `${line} ${words[i]}` : words[i]
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate
      continue
    }
    if (lines.length === maxLines - 1) {
      overflow = true // ya estamos en la ultima linea y todavia quedan palabras
      break
    }
    lines.push(line)
    line = words[i]
  }
  if (line) lines.push(line)
  if (overflow) {
    let last = lines[lines.length - 1]
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1)
    }
    lines[lines.length - 1] = `${last}…`
  }
  return lines
}

/** Dibuja la imagen tipo `object-fit: cover`. */
function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

// ─── piezas comunes ───

function drawBackground(ctx, { photo }) {
  ctx.fillStyle = '#0a0b0e'
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  if (photo) {
    drawCover(ctx, photo, 0, 0, CARD_W, CARD_H)
    // La foto del usuario puede ser clara: una capa plana asegura contraste
    // antes del degradado, si no el texto blanco se pierde.
    ctx.fillStyle = 'rgba(8,9,12,0.34)'
    ctx.fillRect(0, 0, CARD_W, CARD_H)
    // El texto vive abajo, asi que ahi es donde hace falta oscurecer.
    const veil = ctx.createLinearGradient(0, CARD_H * 0.3, 0, CARD_H)
    veil.addColorStop(0, 'rgba(8,9,12,0)')
    veil.addColorStop(1, 'rgba(8,9,12,0.92)')
    ctx.fillStyle = veil
    ctx.fillRect(0, 0, CARD_W, CARD_H)
  } else {
    // Sin foto: un degradado casi imperceptible, nada mas. La tarjeta se
    // sostiene con la tipografia, no con adornos.
    const base = ctx.createLinearGradient(0, 0, 0, CARD_H)
    base.addColorStop(0, '#15171d')
    base.addColorStop(1, '#08090c')
    ctx.fillStyle = base
    ctx.fillRect(0, 0, CARD_W, CARD_H)
  }
}

/**
 * Pie unico: marca, cuenta y fecha en la misma linea. La marca va en el color
 * del musculo para que resalte; lo demas en gris, que es apoyo.
 */
function drawFooter(ctx, accent, dateLabel) {
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = accent
  const ancho = trackedText(ctx, 'JOSSFITNESS', MARGIN, SAFE_BOTTOM, font(700, 30, 5))
  ctx.fillStyle = MUTED
  trackedText(ctx, HANDLE, MARGIN + ancho + 26, SAFE_BOTTOM, font(500, 28, 2))
  trackedText(ctx, dateLabel.toUpperCase(), CARD_W - MARGIN, SAFE_BOTTOM, font(500, 26, 3), 'right')
}

/**
 * Los datos secundarios en una sola linea tenue ("6 REPS · 1RM 121 KG") en vez
 * de una rejilla de cifras con etiquetas: es la mitad de texto y no compite con
 * el dato grande.
 */
function drawMeta(ctx, partes, baseline) {
  const texto = partes.filter(Boolean).join('   ·   ').toUpperCase()
  if (!texto) return
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = MUTED
  trackedText(ctx, texto, MARGIN, baseline, fitFont(ctx, texto, CONTENT_W, 500, 30, 20, 4))
}

// ─── tarjetas ───

function drawPRCard(ctx, data) {
  const { accent } = data
  drawBackground(ctx, data)
  drawFooter(ctx, accent, data.dateLabel)

  ctx.textBaseline = 'alphabetic'

  // Se apila de abajo hacia arriba: el bloque queda pegado al pie sin importar
  // cuanto ocupen el nombre del ejercicio o el numero.
  const metaBaseline = SAFE_BOTTOM - 118
  drawMeta(ctx, [`${data.reps} reps`, `1RM ${data.oneRm} ${data.unit}`], metaBaseline)

  // El peso es lo unico grande de la tarjeta.
  const weightFont = fitFont(ctx, data.weight, CONTENT_W - 200, 800, 300, 120)
  const weightBaseline = metaBaseline - 96
  ctx.fillStyle = INK
  ctx.font = weightFont.css
  ctx.textAlign = 'left'
  ctx.fillText(data.weight, MARGIN - weightFont.size * 0.04, weightBaseline) // compensa el bearing
  const weightWidth = ctx.measureText(data.weight).width

  ctx.fillStyle = accent
  trackedText(ctx, data.unit, MARGIN + weightWidth + 20, weightBaseline, font(600, 58, 1))

  // Nombre del ejercicio en peso ligero: contrasta con el numero y afina el
  // conjunto sin necesitar mas tamano.
  const name = data.exerciseName.toUpperCase()
  const nameFont = fitFont(ctx, name, CONTENT_W, 500, 48, 26, 3)
  const nameLines = wrapLines(ctx, name, CONTENT_W, nameFont.css, 2)
  const lineH = 60
  const nameTop = weightBaseline - weightFont.size * 0.72 - 40
  ctx.fillStyle = INK
  nameLines.forEach((line, i) => {
    trackedText(ctx, line, MARGIN, nameTop - (nameLines.length - 1 - i) * lineH, nameFont)
  })

  ctx.fillStyle = accent
  trackedText(ctx, 'NUEVO RECORD', MARGIN, nameTop - (nameLines.length - 1) * lineH - 58, font(700, 26, 8))
}

function drawWorkoutCard(ctx, data) {
  const { accent } = data
  drawBackground(ctx, data)
  drawFooter(ctx, accent, data.dateLabel)

  ctx.textBaseline = 'alphabetic'

  const metaBaseline = SAFE_BOTTOM - 118
  drawMeta(ctx, data.meta, metaBaseline)

  // El titulo ya nombra los musculos del dia, asi que no hay subtitulo.
  const title = data.title.toUpperCase()
  const titleFont = fitFont(ctx, title, CONTENT_W, 800, 96, 44, 1)
  const titleLines = wrapLines(ctx, title, CONTENT_W, titleFont.css, 3)
  const lineH = titleFont.size + 12
  const baseline = metaBaseline - 96
  ctx.fillStyle = INK
  titleLines.forEach((line, i) => {
    trackedText(ctx, line, MARGIN, baseline - (titleLines.length - 1 - i) * lineH, titleFont)
  })

  ctx.fillStyle = accent
  const top = baseline - (titleLines.length - 1) * lineH - titleFont.size * 0.72
  trackedText(ctx, 'ENTRENO COMPLETADO', MARGIN, top - 44, font(700, 26, 8))
}

/**
 * Pinta la tarjeta en un canvas ya dimensionado a CARD_W x CARD_H.
 * `data.kind` es 'pr' o 'workout'.
 */
export async function renderShareCard(canvas, data) {
  // Sin esto la primera tarjeta puede salir con la fuente de respaldo.
  if (document.fonts?.ready) {
    try { await document.fonts.ready } catch { /* sin soporte: seguimos */ }
  }
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, CARD_W, CARD_H)
  if (data.kind === 'pr') drawPRCard(ctx, data)
  else drawWorkoutCard(ctx, data)
  return canvas
}

/** Carga un File de <input type="file"> como imagen lista para dibujar. */
export function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')) }
    img.src = url
  })
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

/**
 * Abre la hoja nativa de compartir (Instagram, WhatsApp, etc.) con el PNG.
 * Si el navegador no comparte archivos, descarga la imagen.
 * Devuelve 'shared' | 'downloaded' | 'cancelled'.
 */
export async function shareCardImage(canvas, { filename, title, text }) {
  const blob = await canvasToBlob(canvas)
  if (!blob) throw new Error('No se pudo generar la imagen')
  const file = new File([blob], filename, { type: 'image/png' })

  // Instagram no deja anadir el sticker de mencion desde la web: la hoja de
  // compartir solo entrega la imagen. Lo mas cerca que se puede llegar es
  // dejar la cuenta en el portapapeles para pegarla de un toque en el editor.
  try { await navigator.clipboard?.writeText(HANDLE) } catch { /* sin permiso */ }

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
      // Cualquier otro fallo (permisos, app sin soporte) cae a la descarga.
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
