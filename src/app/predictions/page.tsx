'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Prediction {
  breakName: string
  breakId: string
  region: string
  prediction: 'amazing' | 'fun' | 'bad' | 'unknown'
  confidence: number
  similarSessions: number
  currentForecast: any
}

export default function Predictions() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    loadPredictions()
  }, [])

  const loadPredictions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Get user's breaks
      const { data: breaks, error: breaksError } = await supabase
        .from('surf_breaks')
        .select('*')
        .eq('user_id', user.id)

      if (breaksError) throw breaksError

      // Get predictions for each break
      const predictionPromises = breaks.map(async (surfBreak) => {
        const prediction = await generatePrediction(surfBreak, user.id)
        return prediction
      })

      const allPredictions = await Promise.all(predictionPromises)
      setPredictions(allPredictions.filter(p => p !== null))
    } catch (error) {
      console.error('Error loading predictions:', error)
    } finally {
      setLoading(false)
    }
  }

  const generatePrediction = async (surfBreak: any, userId: string) => {
    try {
      // Get user's historical sessions for this break
      const { data: sessions, error: sessionsError } = await supabase
        .from('surf_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('break_id', surfBreak.id)

      if (sessionsError) throw sessionsError

      // Get current forecast for this break
      const today = new Date().toISOString().split('T')[0]
      const currentHour = new Date().getHours()
      
      let timeOfDay = '6am'
      if (currentHour >= 8 && currentHour < 10) timeOfDay = '8am'
      else if (currentHour >= 10 && currentHour < 12) timeOfDay = '10am'
      else if (currentHour >= 12 && currentHour < 14) timeOfDay = '12pm'
      else if (currentHour >= 14 && currentHour < 16) timeOfDay = '2pm'
      else if (currentHour >= 16 && currentHour < 18) timeOfDay = '4pm'
      else if (currentHour >= 18 && currentHour < 20) timeOfDay = '6pm'

      const { data: currentForecast, error: forecastError } = await supabase
        .from('forecast_data')
        .select('*')
        .eq('break_id', surfBreak.id)
        .eq('forecast_date', today)
        .eq('forecast_time', timeOfDay)
        .single()

      if (forecastError || !currentForecast) {
        return {
          breakName: surfBreak.name,
          breakId: surfBreak.id,
          region: surfBreak.region,
          prediction: 'unknown' as const,
          confidence: 0,
          similarSessions: 0,
          currentForecast: null
        }
      }

      // Find similar historical conditions by getting forecast data for each session
      const similarSessions = []
      
      for (const session of sessions) {
        // Get forecast data for this session
        const { data: sessionForecast, error: sessionForecastError } = await supabase
          .from('forecast_data')
          .select('*')
          .eq('break_id', surfBreak.id)
          .eq('forecast_date', session.session_date)
          .eq('forecast_time', session.session_time)
          .single()

        if (!sessionForecastError && sessionForecast) {
          const similarity = calculateSimilarity(currentForecast, sessionForecast)
          if (similarity > 0.6) { // 60% similarity threshold
            similarSessions.push({
              ...session,
              forecast_data: sessionForecast,
              similarity: similarity
            })
          }
        }
      }

      if (similarSessions.length === 0) {
        return {
          breakName: surfBreak.name,
          breakId: surfBreak.id,
          region: surfBreak.region,
          prediction: 'unknown' as const,
          confidence: 0,
          similarSessions: 0,
          currentForecast
        }
      }

      // Calculate prediction based on similar sessions
      const ratings = similarSessions.map(s => s.rating)
      const prediction = getMostCommonRating(ratings)
      const confidence = Math.min((similarSessions.length / 10) * 100, 100) // Max 100%

      return {
        breakName: surfBreak.name,
        breakId: surfBreak.id,
        region: surfBreak.region,
        prediction,
        confidence: Math.round(confidence),
        similarSessions: similarSessions.length,
        currentForecast
      }
    } catch (error) {
      console.error(`Error generating prediction for ${surfBreak.name}:`, error)
      return null
    }
  }

  const calculateSimilarity = (current: any, historical: any) => {
    let similarityScore = 0
    let factors = 0

    // Compare swell height (most important)
    if (current.swell_height && historical.swell_height) {
      const heightDiff = Math.abs(current.swell_height - historical.swell_height)
      const heightSimilarity = Math.max(0, 1 - (heightDiff / 3)) // 3ft tolerance
      similarityScore += heightSimilarity * 0.4 // 40% weight
      factors += 0.4
    }

    // Compare wind speed
    if (current.wind_speed && historical.wind_speed) {
      const windDiff = Math.abs(current.wind_speed - historical.wind_speed)
      const windSimilarity = Math.max(0, 1 - (windDiff / 20)) // 20kt tolerance
      similarityScore += windSimilarity * 0.3 // 30% weight
      factors += 0.3
    }

    // Compare swell period
    if (current.swell_period && historical.swell_period) {
      const periodDiff = Math.abs(current.swell_period - historical.swell_period)
      const periodSimilarity = Math.max(0, 1 - (periodDiff / 5)) // 5s tolerance
      similarityScore += periodSimilarity * 0.2 // 20% weight
      factors += 0.2
    }

    // Compare directions (simplified)
    if (current.wind_direction && historical.wind_direction) {
      const directionSimilarity = current.wind_direction === historical.wind_direction ? 1 : 0
      similarityScore += directionSimilarity * 0.1 // 10% weight
      factors += 0.1
    }

    return factors > 0 ? similarityScore / factors : 0
  }

  const getMostCommonRating = (ratings: string[]) => {
    const counts = ratings.reduce((acc, rating) => {
      acc[rating] = (acc[rating] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.keys(counts).reduce((a, b) => 
      counts[a] > counts[b] ? a : b
    ) as 'amazing' | 'fun' | 'bad'
  }

  const getPredictionStyle = (prediction: string) => {
    switch (prediction) {
      case 'amazing': return { backgroundColor: '#16a34a', color: '#ffffff' }
      case 'fun': return { backgroundColor: '#eab308', color: '#ffffff' }
      case 'bad': return { backgroundColor: '#dc2626', color: '#ffffff' }
      default: return { backgroundColor: '#6b7280', color: '#ffffff' }
    }
  }

  const getPredictionEmoji = (prediction: string) => {
    switch (prediction) {
      case 'amazing': return '🤩'
      case 'fun': return '😊'
      case 'bad': return '😞'
      default: return '🤷'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <p>Loading predictions...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Header */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', padding: '24px', border: '2px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <button 
                onClick={() => router.push('/dashboard')}
                style={{
                  color: '#2563eb',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  marginRight: '16px',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                ← Back to Dashboard
              </button>
              <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>Surf Predictions</h1>
            </div>
          </div>

          {predictions.length === 0 ? (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', padding: '48px', border: '2px solid #e2e8f0', textAlign: 'center' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#1f2937' }}>No Predictions Available</h2>
              <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '16px' }}>
                You need more surf sessions logged to generate predictions. Log at least 5-10 sessions per break to see personalized forecasts.
              </p>
              <button 
                onClick={() => router.push('/log-surf')}
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
                Log More Sessions
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {predictions.map((prediction) => (
                <div key={prediction.breakId} style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', padding: '24px', border: '2px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: '0 0 4px 0' }}>{prediction.breakName}</h3>
                      <p style={{ color: '#6b7280', margin: 0, fontSize: '16px' }}>{prediction.region}</p>
                    </div>
                    <div style={{
                      ...getPredictionStyle(prediction.prediction),
                      padding: '12px 20px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      <span style={{ fontSize: '24px' }}>{getPredictionEmoji(prediction.prediction)}</span>
                      <span style={{ fontWeight: 'bold', fontSize: '18px', textTransform: 'capitalize' }}>{prediction.prediction}</span>
                    </div>
                  </div>

                  {prediction.prediction !== 'unknown' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2563eb', marginBottom: '4px' }}>{prediction.confidence}%</div>
                        <div style={{ color: '#6b7280', fontSize: '14px' }}>Confidence</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#16a34a', marginBottom: '4px' }}>{prediction.similarSessions}</div>
                        <div style={{ color: '#6b7280', fontSize: '14px' }}>Similar Sessions</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => router.push(`/log-surf?break=${prediction.breakId}`)}
                          style={{
                            backgroundColor: '#16a34a',
                            color: '#ffffff',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}
                        >
                          Log Today's Surf
                        </button>
                      </div>
                    </div>
                  )}

                  {prediction.currentForecast && (
                    <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '20px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', marginTop: '16px' }}>
                      <h4 style={{ fontWeight: 'bold', marginBottom: '12px', color: '#1f2937', fontSize: '18px' }}>Current Conditions:</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2563eb', marginBottom: '4px' }}>
                            {prediction.currentForecast.swell_height || 'N/A'}ft
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>Swell</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2563eb', marginBottom: '4px' }}>
                            {prediction.currentForecast.wind_speed || 'N/A'}kt
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>Wind</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2563eb', marginBottom: '4px' }}>
                            {prediction.currentForecast.swell_period || 'N/A'}s
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>Period</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2563eb', marginBottom: '4px' }}>
                            {prediction.currentForecast.swell_direction || 'N/A'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>Direction</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}