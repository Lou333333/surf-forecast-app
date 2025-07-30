'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'

interface SurfBreak {
  id: string
  name: string
  region: string
  swellnet_url: string
  created_at: string
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [breaks, setBreaks] = useState<SurfBreak[]>([])
  const [sessionStats, setSessionStats] = useState({
    total: 0,
    amazing: 0,
    fun: 0,
    bad: 0
  })
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
        loadBreaks(user.id)
        loadSessionStats(user.id)
      }
      setLoading(false)
    }

    getUser()
  }, [router])

  const loadBreaks = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('surf_breaks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setBreaks(data || [])
    } catch (error) {
      console.error('Error loading breaks:', error)
    }
  }

  const loadSessionStats = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('surf_sessions')
        .select('rating')
        .eq('user_id', userId)

      if (error) throw error

      const stats = {
        total: 0,
        amazing: 0,
        fun: 0,
        bad: 0
      }

      data?.forEach(session => {
        stats.total++
        stats[session.rating as keyof typeof stats]++
      })

      setSessionStats(stats)
    } catch (error) {
      console.error('Error loading session stats:', error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const deleteBreak = async (breakId: string) => {
    if (!confirm('Are you sure you want to delete this break?')) return

    try {
      const { error } = await supabase
        .from('surf_breaks')
        .delete()
        .eq('id', breakId)

      if (error) throw error

      setBreaks(breaks.filter(b => b.id !== breakId))
    } catch (error) {
      console.error('Error deleting break:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-800">
              Surf Dashboard
            </h1>
            <div className="flex space-x-2">
              <button
                onClick={() => router.push('/predictions')}
                className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
              >
                View Predictions
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Logout
              </button>
            </div>
          </div>
          <p className="text-gray-600 mt-2">
            Welcome, {user?.email}!
          </p>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Quick Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">{breaks.length}</div>
              <div className="text-gray-600">Surf Breaks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{sessionStats.total}</div>
              <div className="text-gray-600">Sessions Logged</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">{sessionStats.amazing}</div>
              <div className="text-gray-600">Amazing Sessions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{sessionStats.bad}</div>
              <div className="text-gray-600">Bad Sessions</div>
            </div>
          </div>
        </div>

        {/* Surf Breaks Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Your Surf Breaks</h2>
            <button
              onClick={() => router.push('/add-break')}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Add New Break
            </button>
          </div>

          {breaks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                No surf breaks added yet. Let&apos;s add your first break!
              </p>
              <button
                onClick={() => router.push('/add-break')}
                className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
              >
                Add Your First Break
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {breaks.map((surfBreak) => (
                <div key={surfBreak.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg">{surfBreak.name}</h3>
                    <button
                      onClick={() => deleteBreak(surfBreak.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="text-gray-600 mb-3">
                    {surfBreak.region} forecast region
                  </p>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => router.push(`/log-surf?break=${surfBreak.id}`)}
                      className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                    >
                      Log Surf
                    </button>
                    <a
                      href={surfBreak.swellnet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 inline-block"
                    >
                      View WillyWeather
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}