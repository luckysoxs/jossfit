import { useState, useEffect } from 'react'
import api from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { ShoppingBag, ExternalLink } from 'lucide-react'

const CATEGORIES = ['Todos', 'Training', 'Casual', 'Hoodies', 'Joggers', 'Polos']
const STORE_URL = 'https://johnleopard.com.mx/JOSSFIT'

export default function Store() {
  const [products, setProducts] = useState([])
  const [category, setCategory] = useState('Todos')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/store/products').then((r) => setProducts(r.data)).finally(() => setLoading(false))
  }, [])

  const filtered = category === 'Todos'
    ? products
    : products.filter((p) => p.category === category)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tienda</h1>
        <a
          href={STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex items-center gap-2 text-sm py-2 px-4"
        >
          <ExternalLink size={16} /> Ver tienda
        </a>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Usa el código <span className="font-bold text-brand-500">JOSSFIT</span> para descuento exclusivo
      </p>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              category === c
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((p) => (
            <a
              key={p.id}
              href={STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="card hover:scale-[1.02] transition-transform p-0 overflow-hidden"
            >
              <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center">
                <ShoppingBag size={40} className="text-gray-300 dark:text-gray-600" />
              </div>
              <div className="p-3">
                <p className="font-medium text-sm">{p.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{p.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-brand-500">${p.price.toLocaleString('es-MX')}</span>
                  <span className="text-xs bg-brand-50 dark:bg-brand-500/10 text-brand-500 px-2 py-0.5 rounded-full">{p.category}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
