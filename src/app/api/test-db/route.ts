import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Test basic connection
    const { data: breaks, error: breaksError } = await supabase
      .from('surf_breaks')
      .select('id, name, region')
      .limit(5)

    if (breaksError) throw breaksError

    // Test forecast data table
    const { data: forecasts, error: forecastError } = await supabase
      .from('forecast_data')
      .select('*')
      .limit(5)

    if (forecastError) throw forecastError

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      data: {
        breaks_count: breaks?.length || 0,
        forecasts_count: forecasts?.length || 0,
        sample_breaks: breaks,
        sample_forecasts: forecasts
      }
    })
  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json({
      success: false,
     error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}