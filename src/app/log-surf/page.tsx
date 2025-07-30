'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

interface SurfBreak {
  id: string
  name: string
  region: string
}

export default function LogSurf() {
  const [breaks, setBreaks] = useState<SurfBreak[]>([])
  const [selectedBreakId, setSelectedBreakId] = useState('')
  const [rating, setRating] = useState<'amazing' | 'fun' | 'bad' | ''>('')
  const [sessionDate, setSessionDate] = useState('')
  const [sessionTime, setSessionTime] = useState<'morning' | 'midday' | 'afternoon' | ''>('')
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

  const getRatingColor = (ratingType: string) => {
    switch (ratingType) {
      case 'amazing': return 'bg-green-500 hover:bg-green-600 border-green-500'
      case 'fun': return 'bg-yellow-500 hover:bg-yellow-600 border-yellow-500'
      case 'bad': return 'bg-red-500 hover:bg-red-600 border-red-500'
      default: return 'bg-gray-200 hover:bg-gray-300 border-gray-300'
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

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Break Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
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
                    onClick={() => setRating(option.value as any)}
                    className={`p-4 border-2 rounded-lg text-center transition-colors ${
                      rating === option.value
                        ? getRatingColor(option.value)
                        : 'bg-gray-100 border-gray-200 hover:bg-gray-200'
                    } ${rating === option.value ? 'text-white' : 'text-gray-700'}`}
                  >
                    <div className="text-2xl mb-1">{option.emoji}</div>
                    <div className="font-semibold">{option.label}</div>
                    <div className="text-xs opacity-75 mt-1">{option.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time of Day
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'morning', label: 'Morning', time: '6AM - 10AM' },
                  { value: 'midday', label: 'Midday', time: '10AM - 3PM' },
                  { value: 'afternoon', label: 'Afternoon', time: '3PM - 7PM' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSessionTime(option.value as any)}
                    className={`p-3 border-2 rounded-lg text-center transition-colors ${
                      sessionTime === option.value
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    <div className="font-semibold">{option.label}</div>
                    <div className="text-sm opacity-75">{option.time}</div>
                  </button>
                ))}
              </div>
            </div>

            {message && (
              <div className={`text-center py-2 px-4 rounded ${ 
                message.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700' 
              }`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 text-white py-3 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50 font-semibold"
            >
              {loading ? 'Logging Session...' : 'Log Surf Session'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}