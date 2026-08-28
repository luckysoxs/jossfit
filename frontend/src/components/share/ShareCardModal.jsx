import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Share2, ImagePlus, Trash2, Loader2, Download } from 'lucide-react'
import { renderShareCard, loadImageFile, shareCardImage, CARD_W, CARD_H, HANDLE } from '../../utils/shareCard'

/**
 * Preview + compartir de una tarjeta (PR o entreno completado).
 *
 * `card` es el objeto que espera renderShareCard (kind, accent, textos...).
 * La foto de fondo la elige el usuario aqui y no sale del telefono: se dibuja
 * en el canvas y se comparte como PNG, nunca se sube al servidor.
 */
export default function ShareCardModal({ card, onClose, filename, shareText }) {
  const canvasRef = useRef(null)
  const fileRef = useRef(null)
  const [photo, setPhoto] = useState(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const paint = useCallback(async () => {
    if (!canvasRef.current) return
    await renderShareCard(canvasRef.current, { ...card, photo })
  }, [card, photo])

  useEffect(() => { paint() }, [paint])

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reelegir el mismo archivo
    if (!file) return
    try {
      setPhoto(await loadImageFile(file))
      setNote('')
    } catch {
      setNote('No se pudo leer esa imagen')
    }
  }

  const share = async () => {
    setBusy(true)
    setNote('')
    try {
      const result = await shareCardImage(canvasRef.current, {
        filename,
        title: shareText,
        text: shareText,
      })
      if (result === 'downloaded') setNote(`Imagen descargada · ${HANDLE} copiado para pegarlo`)
      if (result === 'shared') onClose()
    } catch {
      setNote('No se pudo compartir, intenta de nuevo')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-gray-900 rounded-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-bold text-white">Compartir</span>
          <button onClick={onClose} className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <div className="px-4">
          {/* 9:16 es muy alto para un modal: mandamos sobre el alto, no el ancho. */}
          <canvas
            ref={canvasRef}
            width={CARD_W}
            height={CARD_H}
            className="mx-auto block rounded-2xl shadow-lg"
            style={{ aspectRatio: `${CARD_W} / ${CARD_H}`, maxHeight: '56vh', width: 'auto', maxWidth: '100%' }}
          />
        </div>

        {note && <p className="px-5 pt-3 text-xs text-gray-400 text-center">{note}</p>}

        <div className="p-4 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white bg-white/10 hover:bg-white/15 transition-colors"
            >
              <ImagePlus size={17} />
              {photo ? 'Cambiar foto' : 'Foto de fondo'}
            </button>
            {photo && (
              <button
                onClick={() => setPhoto(null)}
                aria-label="Quitar foto de fondo"
                className="px-4 rounded-2xl text-gray-300 bg-white/10 hover:bg-white/15 transition-colors"
              >
                <Trash2 size={17} />
              </button>
            )}
          </div>

          <button
            onClick={share}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 transition-colors disabled:opacity-60"
          >
            {busy
              ? <><Loader2 size={18} className="animate-spin" /> Preparando...</>
              : <><Share2 size={18} /> Compartir</>}
          </button>

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500 text-center">
            <Download size={12} className="flex-shrink-0" />
            Al compartir se copia {HANDLE} para pegarlo como mención
          </p>
        </div>

        <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} className="hidden" />
      </div>
    </div>
  )
}
