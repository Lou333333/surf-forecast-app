'use client'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

interface SurfBreak {
  id: string
  name: string
  region: string
}

function LogSurfContent() {
  const [breaks, setBreaks] = useState<SurfBreak[]>([])
  const [selectedBreakId, setSelectedBreakId] = useState('')
  const [rating, setRating] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [sessionTime, setSessionTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    loadBreaks()
    
    // Pre-select break if passed in URL
    const breakId = searchParams.get('break')
    if (breakId) {
      setSelectedBreakId(breakId)
    }

    // Set today's date as default
    const today = new Date().toISOString().split('T')[0]
    setSessionDate(today)
  }, [searchParams])

  const loadBreaks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('surf_breaks')
        .select('id, name, region')
        .eq('user_id', user.id)
        .order('name')

      if (error) throw error
      setBreaks(data || [])
    } catch (error) {
      console.error('Error loading breaks:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedBreakId || !rating || !sessionDate || !sessionTime) {
      setMessage('Please fill in all fields')
      return
    }

    setLoading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { error } = await supabase
        .from('surf_sessions')
        .insert([
          {
            user_id: user.id,
            break_id: selectedBreakId,
            rating,
            session_date: sessionDate,
            session_time: sessionTime
          }
        ])

      if (error) throw error

      setMessage('Surf session logged successfully!')
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
      
    } catch (error) {
      setMessage('Error logging session. Please try again.')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (breaks.length === 0) {
    return (
      <div className="min-h-screen bg-blue-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">No Breaks Found</h1>
            <p className="text-gray-600 mb-6">
              You need to add some surf breaks before you can log sessions.
            </p>
            <button
              onClick={() => router.push('/add-break')}
              className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
            >
              Add Your First Break
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-blue-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-6">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-blue-500 hover:text-blue-700 mr-4"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-gray-800">Log Surf Session</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Break Selection */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Surf Break
              </label>
              <select
                value={selectedBreakId}
                onChange={(e) => setSelectedBreakId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a break...</option>
                {breaks.map((surfBreak) => (
                  <option key={surfBreak.id} value={surfBreak.id}>
                    {surfBreak.name} ({surfBreak.region})
                  </option>
                ))}
              </select>
            </div>

            {/* Rating Selection */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-4">
                How was the surf?
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'amazing', label: 'Amazing', emoji: '🤩', desc: 'Epic session!' },
                  { value: 'fun', label: 'Fun', emoji: '😊', desc: 'Good waves' },
                  { value: 'bad', label: 'Bad', emoji: '😞', desc: 'Poor conditions' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRating(option.value)}
                    className={`p-4 border-4 rounded-xl text-center transition-all ${
                      rating === option.value
                        ? option.value === 'amazing' 
                          ? 'bg-green-600 border-green-800 text-white shadow-2xl'
                          : option.value === 'fun'
                          ? 'bg-yellow-500 border-yellow-700 text-black shadow-2xl'
                          : 'bg-red-600 border-red-800 text-white shadow-2xl'
                        : 'bg-white border-gray-300 text-gray-600 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div className="text-3xl mb-2">{option.emoji}</div>
                    <div className={`font-bold text-lg ${rating === option.value ? 'text-white' : 'text-gray-700'}`}>
                      {option.label}
                    </div>
                    <div className={`text-xs mt-1 ${rating === option.value ? 'text-white opacity-90' : 'text-gray-500'}`}>
                      {option.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Selection */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Session Date
              </label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Time Selection */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Time of Day
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { value: '6am', label: '6-8AM' },
                  { value: '8am', label: '8-10AM' },
                  { value: '10am', label: '10AM-12PM' },
                  { value: '12pm', label: '12-2PM' },
                  { value: '2pm', label: '2-4PM' },
                  { value: '4pm', label: '4-6PM' },
                  { value: '6pm', label: '6-8PM' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSessionTime(option.value)}
                    className={`p-4 border-4 rounded-xl text-center transition-all ${
                      sessionTime === option.value
                        ? 'bg-blue-600 border-blue-800 text-white shadow-2xl'
                        : 'bg-white border-gray-300 text-gray-600 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div className={`font-bold text-lg ${sessionTime === option.value ? 'text-white' : 'text-gray-700'}`}>
                      {option.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {message && (
              <div className={`text-center py-3 px-4 rounded-lg font-semibold ${
                message.includes('success') 
                  ? 'bg-green-100 text-green-800 border-2 border-green-300' 
                  : 'bg-red-100 text-red-800 border-2 border-red-300'
              }`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bold text-lg shadow-lg"
            >
              {loading ? 'Logging Session...' : 'Log Surf Session'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LogSurf() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-blue-50 flex items-center justify-center">Loading...</div>}>
      <LogSurfContent />
    </Suspense>
  )
}