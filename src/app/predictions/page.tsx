// Update your src/app/predictions/page.tsx file with these changes:

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { convertUnits } from '@/lib/units' // Add this import

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

    // Compare swell height (most important) - Convert to metres for comparison
    if (current.swell_height && historical.swell_height) {
      const currentMetres = convertUnits.feetToMetres(current.swell_height)
      const historicalMetres = convertUnits.feetToMetres(historical.swell_height)
      const heightDiff = Math.abs(currentMetres - historicalMetres)
      const heightSimilarity = Math.max(0, 1 - (heightDiff / 1)) // 1m tolerance (was 3ft)
      similarityScore += heightSimilarity * 0.4 // 40% weight
      factors += 0.4
    }

    // Compare wind speed - Convert to km/h for comparison
    if (current.wind_speed && historical.wind_speed) {
      const currentKmh = convertUnits.knotsToKmh(current.wind_speed)
      const historicalKmh = convertUnits.knotsToKmh(historical.wind_speed)
      const windDiff = Math.abs(currentKmh - historicalKmh)
      const windSimilarity = Math.max(0, 1 - (windDiff / 37)) // ~37km/h tolerance (was 20kt)
      similarityScore += windSimilarity * 0.3 // 30% weight
      factors += 0.3
    }

    // Compare swell period (unchanged as it's already in seconds)
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
    )
  }

  const getPredictionColor = (prediction: string) => {
    switch (prediction) {
      case 'amazing': return '#16a34a' // green
      case 'fun': return '#2563eb' // blue  
      case 'bad': return '#dc2626' // red
      default: return '#6b7280' // gray
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#eff6ff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{ fontSize: '18px', color: '#6b7280' }}>Loading predictions...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#eff6ff' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              color: '#2563eb',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 'bold',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              marginRight: '16px'
            }}
          >
            ← Back to Dashboard
          </button>
          <h1 style={{ fontSize: '48px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
            Surf Predictions
          </h1>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
          {predictions.length === 0 ? (
            <div style={{ padding: '64px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#1f2937' }}>No Predictions Available</h2>
              <p style={{ color: '#6b7280', fontSize: '16px', marginBottom: '24px' }}>
                Add some surf breaks and log a few sessions to start getting predictions!
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
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                Add Your First Break
              </button>
            </div>
          ) : (
            <div style={{ padding: '32px' }}>
              {predictions.map((prediction, index) => (
                <div
                  key={prediction.breakId}
                  style={{
                    borderBottom: index < predictions.length - 1 ? '1px solid #e5e7eb' : 'none',
                    paddingBottom: index < predictions.length - 1 ? '32px' : '0',
                    marginBottom: index < predictions.length - 1 ? '32px' : '0'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', color: '#1f2937' }}>
                        {prediction.breakName}
                      </h2>
                      <p style={{ color: '#6b7280', fontSize: '16px', marginBottom: '8px' }}>
                        {prediction.region}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          backgroundColor: getPredictionColor(prediction.prediction),
                          color: '#ffffff',
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                          marginBottom: '8px'
                        }}
                      >
                        {prediction.prediction}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {prediction.confidence}% confidence
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {prediction.similarSessions} similar sessions
                      </div>
                    </div>
                  </div>

                  {prediction.prediction !== 'unknown' && (
                    <div style={{ backgroundColor: '#f3f4f6', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '14px', color: '#6b7280' }}>
                          Based on {prediction.similarSessions} similar session{prediction.similarSessions !== 1 ? 's' : ''}
                        </div>
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
                            {convertUnits.formatSwellHeight(prediction.currentForecast.swell_height)}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>Swell</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2563eb', marginBottom: '4px' }}>
                            {convertUnits.formatWindSpeed(prediction.currentForecast.wind_speed)}
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
                            {prediction.currentForecast.swell_direction || 'N/A'}°
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