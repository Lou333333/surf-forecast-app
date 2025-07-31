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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Header */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', padding: '24px', border: '2px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
                Surf Dashboard
              </h1>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => router.push('/predictions')}
                  style={{
                    backgroundColor: '#7c3aed',
                    color: '#ffffff',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  View Predictions
                </button>
                <button
                  onClick={handleLogout}
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  Logout
                </button>
              </div>
            </div>
            <p style={{ color: '#6b7280', margin: 0, fontSize: '16px' }}>
              Welcome, {user?.email}!
            </p>
          </div>

          {/* Quick Stats */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', padding: '24px', border: '2px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: '#1f2937' }}>Quick Stats</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '24px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb', marginBottom: '8px' }}>{breaks.length}</div>
                <div style={{ color: '#6b7280', fontSize: '16px' }}>Surf Breaks</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#16a34a', marginBottom: '8px' }}>{sessionStats.total}</div>
                <div style={{ color: '#6b7280', fontSize: '16px' }}>Sessions Logged</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#eab308', marginBottom: '8px' }}>{sessionStats.amazing}</div>
                <div style={{ color: '#6b7280', fontSize: '16px' }}>Amazing Sessions</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#dc2626', marginBottom: '8px' }}>{sessionStats.bad}</div>
                <div style={{ color: '#6b7280', fontSize: '16px' }}>Bad Sessions</div>
              </div>
            </div>
          </div>

          {/* Surf Breaks Section */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', padding: '24px', border: '2px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>Your Surf Breaks</h2>
              <button
                onClick={() => router.push('/add-break')}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                Add New Break
              </button>
            </div>

            {breaks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px' }}>
                <p style={{ color: '#6b7280', marginBottom: '16px', fontSize: '16px' }}>
                  No surf breaks added yet. Let's add your first break!
                </p>
                <button
                  onClick={() => router.push('/add-break')}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  Add Your First Break
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {breaks.map((surfBreak) => (
                  <div key={surfBreak.id} style={{ 
                    border: '2px solid #e5e7eb', 
                    borderRadius: '12px', 
                    padding: '20px',
                    backgroundColor: '#f8fafc',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h3 style={{ fontWeight: 'bold', fontSize: '20px', color: '#1f2937', margin: 0 }}>{surfBreak.name}</h3>
                      <button
                        onClick={() => deleteBreak(surfBreak.id)}
                        style={{
                          color: '#dc2626',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          padding: '4px 8px',
                          borderRadius: '4px'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    <p style={{ color: '#6b7280', marginBottom: '16px', fontSize: '14px' }}>
                      {surfBreak.region} forecast region
                    </p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => router.push(`/log-surf?break=${surfBreak.id}`)}
                        style={{
                          backgroundColor: '#16a34a',
                          color: '#ffffff',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}
                      >
                        Log Surf
                      </button>
                      <a
                        href={surfBreak.swellnet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          textDecoration: 'none',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                          display: 'inline-block'
                        }}
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
    </div>
  )
}