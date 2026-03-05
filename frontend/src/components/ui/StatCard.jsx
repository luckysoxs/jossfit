export default function StatCard({ icon: Icon, label, value, sub, color = 'brand' }) {
  const colors = {
    brand: 'text-brand-500 bg-brand-50 dark:bg-brand-500/10',
    green: 'text-green-500 bg-green-50 dark:bg-green-500/10',
    blue: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
    purple: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10',
    red: 'text-red-500 bg-red-50 dark:bg-red-500/10',
  }

  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
      </div>
    </div>
  )
}
