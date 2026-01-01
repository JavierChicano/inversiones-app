'use client';

export default function StatsCard({ title, value, subValue, icon, color = 'blue', className = '', large = false }) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    green: 'bg-green-500/10 text-green-500 border-green-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  };

  return (
    <div
      className={`lg:h-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors flex flex-col ${className}`}
    >
      <div className="flex items-start justify-between mb-auto">
        <h3 className={`${large ? 'text-sm lg:text-lg' : 'text-sm'} text-zinc-400 text-sm font-medium`}>{title}</h3>
        {icon && (
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </div>
        )}
      </div>
      <div className="space-y-1 mt-4">
        <div className={`${large ? 'text-2xl lg:text-4xl' : 'text-2xl'} font-bold text-white`}>{value}</div>
        {subValue && (
          <div className={`${large ? 'text-sm lg:text-lg' : 'text-sm'} text-zinc-500`}>{subValue}</div>
        )}
      </div>
    </div>
  );
}
