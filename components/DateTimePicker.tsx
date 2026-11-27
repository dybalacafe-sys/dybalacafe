import { useEffect, useState } from 'react'
import { FiCalendar } from 'react-icons/fi'

export default function DateTimePicker() {
  const [now, setNow] = useState<Date | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setShowCalendar((s) => !s)}
        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-2.5 py-1 rounded-lg transition-colors"
      >
        <FiCalendar size={14} className="text-gray-500" />
        <span>
          {now
            ? `${now.toLocaleDateString('en-NP', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · ${now.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
            : ''}
        </span>
      </button>

      {showCalendar && now && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowCalendar(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-50">
            <div className="text-center pb-3 mb-3 border-b border-gray-100">
              <p className="text-2xl font-bold text-gray-900 font-mono">
                {now.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {now.toLocaleDateString('en-NP', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-400 mb-1">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {(() => {
                const year = now.getFullYear()
                const month = now.getMonth()
                const firstDay = new Date(year, month, 1).getDay()
                const daysInMonth = new Date(year, month + 1, 0).getDate()
                const cells = []
                for (let i = 0; i < firstDay; i++) {
                  cells.push(<div key={`empty-${i}`} />)
                }
                for (let day = 1; day <= daysInMonth; day++) {
                  const isToday = day === now.getDate()
                  cells.push(
                    <div
                      key={day}
                      className={`py-1 rounded-md ${
                        isToday
                          ? 'bg-blue-600 text-white font-bold'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {day}
                    </div>
                  )
                }
                return cells
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
