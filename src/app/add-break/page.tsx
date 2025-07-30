'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const AUSTRALIAN_REGIONS = [
  // New South Wales
  { name: 'Sydney', state: 'NSW', url: 'https://swell.willyweather.com.au/nsw/sydney.html' },
  { name: 'Central Coast', state: 'NSW', url: 'https://swell.willyweather.com.au/nsw/central-coast.html' },
  { name: 'Newcastle', state: 'NSW', url: 'https://swell.willyweather.com.au/nsw/hunter.html' },
  { name: 'Mid North Coast', state: 'NSW', url: 'https://swell.willyweather.com.au/nsw/mid-north-coast.html' },
  { name: 'Byron Bay', state: 'NSW', url: 'https://swell.willyweather.com.au/nsw/far-north-coast.html' },
  { name: 'Wollongong', state: 'NSW', url: 'https://swell.willyweather.com.au/nsw/illawarra.html' },
  { name: 'South Coast', state: 'NSW', url: 'https://swell.willyweather.com.au/nsw/south-coast.html' },
  { name: 'Far North Coast', state: 'NSW', url: 'https://swell.willyweather.com.au/nsw/far-north-coast.html' },

  // Queensland
  { name: 'Gold Coast', state: 'QLD', url: 'https://swell.willyweather.com.au/qld/gold-coast.html' },
  { name: 'Sunshine Coast', state: 'QLD', url: 'https://swell.willyweather.com.au/qld/sunshine-coast.html' },
  { name: 'Fraser Coast', state: 'QLD', url: 'https://swell.willyweather.com.au/qld/fraser-coast.html' },
  { name: 'Capricorn Coast', state: 'QLD', url: 'https://swell.willyweather.com.au/qld/capricornia.html' },
  { name: 'Mackay', state: 'QLD', url: 'https://swell.willyweather.com.au/qld/mackay.html' },
  { name: 'Townsville', state: 'QLD', url: 'https://swell.willyweather.com.au/qld/townsville.html' },
  { name: 'Cairns', state: 'QLD', url: 'https://swell.willyweather.com.au/qld/far-north-queensland.html' },

  // Victoria
  { name: 'Melbourne', state: 'VIC', url: 'https://swell.willyweather.com.au/vic/melbourne.html' },
  { name: 'Torquay', state: 'VIC', url: 'https://swell.willyweather.com.au/vic/surf-coast.html' },
  { name: 'Phillip Island', state: 'VIC', url: 'https://swell.willyweather.com.au/vic/gippsland.html' },
  { name: 'East Gippsland', state: 'VIC', url: 'https://swell.willyweather.com.au/vic/gippsland.html' },
  { name: 'West Coast', state: 'VIC', url: 'https://swell.willyweather.com.au/vic/surf-coast.html' },

  // South Australia
  { name: 'Adelaide', state: 'SA', url: 'https://swell.willyweather.com.au/sa/adelaide.html' },
  { name: 'Fleurieu Peninsula', state: 'SA', url: 'https://swell.willyweather.com.au/sa/fleurieu-peninsula.html' },
  { name: 'Yorke Peninsula', state: 'SA', url: 'https://swell.willyweather.com.au/sa/yorke-peninsula.html' },
  { name: 'Eyre Peninsula', state: 'SA', url: 'https://swell.willyweather.com.au/sa/eyre-peninsula.html' },
  { name: 'Kangaroo Island', state: 'SA', url: 'https://swell.willyweather.com.au/sa/kangaroo-island.html' },

  // Western Australia
  { name: 'Perth', state: 'WA', url: 'https://swell.willyweather.com.au/wa/perth.html' },
  { name: 'Margaret River', state: 'WA', url: 'https://swell.willyweather.com.au/wa/south-west.html' },
  { name: 'Geraldton', state: 'WA', url: 'https://swell.willyweather.com.au/wa/mid-west.html' },
  { name: 'Esperance', state: 'WA', url: 'https://swell.willyweather.com.au/wa/goldfields-esperance.html' },
  { name: 'Albany', state: 'WA', url: 'https://swell.willyweather.com.au/wa/great-southern.html' },
  { name: 'Exmouth', state: 'WA', url: 'https://swell.willyweather.com.au/wa/pilbara.html' },
  { name: 'Broome', state: 'WA', url: 'https://swell.willyweather.com.au/wa/kimberley.html' },

  // Tasmania
  { name: 'Hobart', state: 'TAS', url: 'https://swell.willyweather.com.au/tas/hobart.html' },
  { name: 'Launceston', state: 'TAS', url: 'https://swell.willyweather.com.au/tas/launceston.html' },
  { name: 'North West Coast', state: 'TAS', url: 'https://swell.willyweather.com.au/tas/north-west.html' },
  { name: 'East Coast', state: 'TAS', url: 'https://swell.willyweather.com.au/tas/east-coast.html' }
]

export default function AddBreak() {
  const [breakName, setBreakName] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  // Group regions by state for better organization
  const regionsByState = AUSTRALIAN_REGIONS.reduce((acc, region) => {
    if (!acc[region.state]) {
      acc[region.state] = []
    }
    acc[region.state].push(region)
    return acc
  }, {} as Record<string, typeof AUSTRALIAN_REGIONS>)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!breakName.trim() || !selectedRegion) {
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

      const selectedRegionData = AUSTRALIAN_REGIONS.find(r => r.name === selectedRegion)
      const { error } = await supabase
        .from('surf_breaks')
        .insert([
          {
            user_id: user.id,
            name: breakName.trim(),
            region: selectedRegion,
            swellnet_url: selectedRegionData?.url || ''
          }
        ])

      if (error) throw error

      setMessage('Break added successfully!')
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
    } catch (error) {
      setMessage('Error adding break. Please try again.')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
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
            <h1 className="text-2xl font-bold text-gray-800">Add New Surf Break</h1>
          </div>

          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">How This Works:</h3>
            <p className="text-blue-700 text-sm">
              Add your specific surf break (e.g., "Bondi Beach", "The Pass", "Superbank") and choose which WillyWeather region it belongs to. This connects your break to the regional forecast data.
            </p>
            <p className="text-blue-600 text-xs mt-2">
              Examples: "Sandon Point" → Wollongong | "The Wreck" → Byron Bay | "Kirra" → Gold Coast
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Break Name
              </label>
              <input
                type="text"
                value={breakName}
                onChange={(e) => setBreakName(e.target.value)}
                placeholder="e.g., Bondi Beach, The Pass, Superbank, Bells Beach"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                WillyWeather Region (Choose the closest forecast region)
              </label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a region...</option>
                {Object.entries(regionsByState).map(([state, regions]) => (
                  <optgroup key={state} label={state}>
                    {regions.map((region) => (
                      <option key={region.name} value={region.name}>
                        {region.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {selectedRegion && (
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-green-700 text-sm">
                  <strong>Forecast Source:</strong> Your break "{breakName || '[Break Name]'}" will use the {selectedRegion} regional forecast from WillyWeather.
                </p>
              </div>
            )}

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
              {loading ? 'Adding Break...' : 'Add Break'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}