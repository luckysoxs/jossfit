import { useState, useEffect } from 'react'
import api from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { Award, ExternalLink, Tag } from 'lucide-react'

export default function Benefits() {
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/benefits/brands').then((r) => setBrands(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Benefits</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Beneficios exclusivos para miembros</p>
      </div>

      {brands.length === 0 ? (
        <div className="card text-center py-12">
          <Award size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">No hay beneficios disponibles</p>
        </div>
      ) : (
        <div className="space-y-4">
          {brands.map((b) => (
            <div key={b.id} className="card">
              <div className="flex items-start gap-4">
                {b.image_url || b.logo_url ? (
                  <img
                    src={b.image_url || b.logo_url}
                    alt={b.name}
                    className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200 dark:from-brand-500/20 dark:to-brand-600/20 flex items-center justify-center flex-shrink-0">
                    <Award size={28} className="text-brand-500" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{b.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{b.description}</p>

                  {b.discount_text && (
                    <div className="flex items-center gap-2 mt-2 bg-green-50 dark:bg-green-500/10 px-3 py-2 rounded-xl">
                      <Tag size={14} className="text-green-500" />
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">{b.discount_text}</span>
                    </div>
                  )}

                  {b.promo_code && (
                    <div className="mt-2 inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
                      <span className="text-xs text-gray-400">Código:</span>
                      <span className="font-mono font-bold text-brand-500">{b.promo_code}</span>
                    </div>
                  )}

                  <a
                    href={b.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-brand-500 text-sm font-medium hover:underline"
                  >
                    Visitar tienda <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
