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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Break Selection */}
            <div style={{ backgroundColor: '#f8fafc', padding: '24px', borderRadius: '12px', border: '2px solid #e2e8f0' }}>
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
            <div style={{ backgroundColor: '#f8fafc', padding: '24px', borderRadius: '12px', border: '2px solid #e2e8f0' }}>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                How was the surf?
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {[
                  { value: 'amazing', label: 'Amazing', emoji: '🤩', desc: 'Epic session!', color: '#16a34a' },
                  { value: 'fun', label: 'Fun', emoji: '😊', desc: 'Good waves', color: '#eab308' },
                  { value: 'bad', label: 'Bad', emoji: '😞', desc: 'Poor conditions', color: '#dc2626' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRating(option.value)}
                    style={{
                      padding: '20px',
                      border: rating === option.value ? `4px solid ${option.color}` : '4px solid #d1d5db',
                      borderRadius: '12px',
                      textAlign: 'center',
                      backgroundColor: rating === option.value ? option.color : '#ffffff',
                      color: rating === option.value ? '#ffffff' : '#374151',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: rating === option.value ? '0 10px 25px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>{option.emoji}</div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{option.label}</div>
                    <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>{option.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Selection */}
            <div style={{ backgroundColor: '#f8fafc', padding: '24px', borderRadius: '12px', border: '2px solid #e2e8f0' }}>
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

            {/* Time Selection - UPDATED with 8pm */}
            <div style={{ backgroundColor: '#f8fafc', padding: '24px', borderRadius: '12px', border: '2px solid #e2e8f0' }}>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Time of Day
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                {[
                  { value: '6am', label: '6-8AM' },
                  { value: '8am', label: '8-10AM' },
                  { value: '10am', label: '10AM-12PM' },
                  { value: '12pm', label: '12-2PM' },
                  { value: '2pm', label: '2-4PM' },
                  { value: '4pm', label: '4-6PM' },
                  { value: '6pm', label: '6-8PM' },
                  { value: '8pm', label: '8-10PM' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSessionTime(option.value)}
                    style={{
                      padding: '16px',
                      border: sessionTime === option.value ? '4px solid #2563eb' : '4px solid #d1d5db',
                      borderRadius: '12px',
                      textAlign: 'center',
                      backgroundColor: sessionTime === option.value ? '#2563eb' : '#ffffff',
                      color: sessionTime === option.value ? '#ffffff' : '#374151',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: sessionTime === option.value ? '0 10px 25px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
                      fontWeight: 'bold',
                      fontSize: '16px'
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {message && (
              <div style={{
                textAlign: 'center',
                padding: '12px 16px',
                borderRadius: '8px',
                fontWeight: 'bold',
                backgroundColor: message.includes('success') ? '#dcfce7' : '#fecaca',
                color: message.includes('success') ? '#166534' : '#991b1b',
                border: message.includes('success') ? '2px solid #bbf7d0' : '2px solid #fca5a5'
              }}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              onClick={handleSubmit}
              style={{
                width: '100%',
                backgroundColor: loading ? '#9ca3af' : '#2563eb',
                color: '#ffffff',
                padding: '16px 24px',
                borderRadius: '12px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                fontSize: '18px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
              }}
            >
              {loading ? 'Logging Session...' : 'Log Surf Session'}
            </button>
          </div>
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
