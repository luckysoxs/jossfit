import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { BookOpen, ArrowLeft, Calendar, Clock } from 'lucide-react'

const CATEGORY_LABELS = {
  general: 'General',
  nutricion: 'Nutrición',
  entrenamiento: 'Entrenamiento',
  suplementos: 'Suplementos',
  salud: 'Salud',
  motivacion: 'Motivación',
}

const CATEGORY_COLORS = {
  general: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  nutricion: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400',
  entrenamiento: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
  suplementos: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
  salud: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
  motivacion: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

function formatDate(dateStr, includeTime = false) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const opts = { day: '2-digit', month: 'short', year: 'numeric' }
  if (includeTime) {
    opts.hour = '2-digit'
    opts.minute = '2-digit'
  }
  return d.toLocaleDateString('es-MX', opts)
}

export default function Notes() {
  const { noteId } = useParams()
  const navigate = useNavigate()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedNote, setSelectedNote] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    api.get('/notes').then(r => {
      setNotes(r.data)
      if (noteId) {
        const found = r.data.find(n => n.id === parseInt(noteId))
        if (found) setSelectedNote(found)
      }
    }).catch(() => {}).finally(() => setLoading(false))

    // Mark note notifications as read when visiting this page
    api.put('/notification-center/read-notes').catch(() => {})
  }, [noteId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  // Note detail view
  if (selectedNote) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <button onClick={() => { setSelectedNote(null); navigate('/notes') }}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowLeft size={20} /> Volver a notas
        </button>

        <div className="card space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[selectedNote.category] || CATEGORY_COLORS.general}`}>
              {CATEGORY_LABELS[selectedNote.category] || selectedNote.category}
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Calendar size={12} />
              {formatDate(selectedNote.created_at, true)}
            </span>
            {selectedNote.updated_at && (
              <span className="text-xs text-blue-400 flex items-center gap-1">
                · Editada {formatDate(selectedNote.updated_at)}
              </span>
            )}
          </div>

          <h1 className="text-xl font-bold">{selectedNote.title}</h1>

          <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {selectedNote.content}
          </div>
        </div>
      </div>
    )
  }

  // Notes list view
  const filtered = filter === 'all' ? notes : notes.filter(n => n.category === filter)
  const categories = ['all', ...new Set(notes.map(n => n.category))]

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
          <BookOpen size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Notas</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Tips, consejos y contenido del equipo</p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar overscroll-x-contain">
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === cat ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}>
            {cat === 'all' ? 'Todas' : (CATEGORY_LABELS[cat] || cat)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <BookOpen size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No hay notas disponibles</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(note => (
            <button key={note.id} onClick={() => { setSelectedNote(note); navigate(`/notes/${note.id}`) }}
              className="card w-full text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm">{note.title}</h3>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{note.content}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${CATEGORY_COLORS[note.category] || CATEGORY_COLORS.general}`}>
                  {CATEGORY_LABELS[note.category] || note.category}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Clock size={10} />
                  {formatDate(note.created_at, true)}
                </p>
                {note.updated_at && (
                  <p className="text-[10px] text-blue-400">· Editada</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
