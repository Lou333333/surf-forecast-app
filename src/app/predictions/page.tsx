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
      
      let timeOfDay = 'morning'
      if (currentHour >= 12 && currentHour < 17) timeOfDay = 'midday'
      else if (currentHour >= 17) timeOfDay = 'afternoon'

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

  const getPredictionColor = (prediction: string) => {
    switch (prediction) {
      case 'amazing': return 'text-green-600 bg-green-100'
      case 'fun': return 'text-yellow-600 bg-yellow-100'
      case 'bad': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
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
        <div className="flex items-center mb-6">
          <button 
            onClick={() => router.push('/dashboard')}
            className="text-blue-500 hover:text-blue-700 mr-4"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Surf Predictions</h1>
        </div>

        {predictions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <h2 className="text-xl font-semibold mb-4">No Predictions Available</h2>
            <p className="text-gray-600 mb-4">
              You need more surf sessions logged to generate predictions. Log at least 5-10 sessions per break to see personalized forecasts.
            </p>
            <button 
              onClick={() => router.push('/log-surf')}
              className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
            >
              Log More Sessions
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {predictions.map((prediction) => (
              <div key={prediction.breakId} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold">{prediction.breakName}</h3>
                    <p className="text-gray-600">{prediction.region}</p>
                  </div>
                  <div className={`px-4 py-2 rounded-lg ${getPredictionColor(prediction.prediction)}`}>
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{getPredictionEmoji(prediction.prediction)}</span>
                      <span className="font-semibold capitalize">{prediction.prediction}</span>
                    </div>
                  </div>
                </div>

                {prediction.prediction !== 'unknown' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-500">{prediction.confidence}%</div>
                      <div className="text-gray-600 text-sm">Confidence</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-500">{prediction.similarSessions}</div>
                      <div className="text-gray-600 text-sm">Similar Sessions</div>
                    </div>
                    <div className="text-center">
                      <button 
                        onClick={() => router.push(`/log-surf?break=${prediction.breakId}`)}
                        className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600"
                      >
                        Log Today's Surf
                      </button>
                    </div>
                  </div>
                )}

                {prediction.currentForecast && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Current Conditions:</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Swell:</span> {prediction.currentForecast.swell_height || 'N/A'}ft
                      </div>
                      <div>
                        <span className="text-gray-600">Wind:</span> {prediction.currentForecast.wind_speed || 'N/A'}kt
                      </div>
                      <div>
                        <span className="text-gray-600">Period:</span> {prediction.currentForecast.swell_period || 'N/A'}s
                      </div>
                      <div>
                        <span className="text-gray-600">Direction:</span> {prediction.currentForecast.swell_direction || 'N/A'}
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
  )
}