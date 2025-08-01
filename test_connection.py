#!/usr/bin/env python3
"""
Test script to verify scraper can connect to deployed app's database
"""

import os
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

def test_env_variables():
    """Test if environment variables are loaded"""
    print("🔧 Checking environment variables...")
    
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY") 
    willy_key = os.getenv("WILLY_WEATHER_API_KEY")
    
    if not supabase_url:
        print("❌ NEXT_PUBLIC_SUPABASE_URL not found")
        return False
    if not supabase_service_key:
        print("❌ SUPABASE_SERVICE_KEY not found")
        return False
    if not willy_key:
        print("❌ WILLY_WEATHER_API_KEY not found")
        return False
        
    print("✅ All environment variables found")
    print(f"  Supabase URL: {supabase_url[:30]}...")
    print(f"  Service Key: {supabase_service_key[:30]}...")
    print(f"  Willy Key: {willy_key[:20]}...")
    return True

def test_supabase_connection():
    """Test direct Supabase connection from scraper"""
    print("\n🧪 Testing Supabase connection from scraper...")
    
    try:
        supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY")  # Use service key
        
        if not supabase_url or not supabase_service_key:
            print("❌ Supabase credentials not found in environment")
            return False
        
        # Initialize Supabase client with SERVICE KEY
        supabase: Client = create_client(supabase_url, supabase_service_key)
        
        # Test reading surf breaks
        response = supabase.table('surf_breaks').select('id, name, region').limit(3).execute()
        
        if response.data:
            print("✅ Supabase connection successful!")
            print(f"📊 Found {len(response.data)} surf breaks:")
            for break_data in response.data:
                print(f"  - {break_data['name']} ({break_data['region']})")
            return True
        else:
            print("⚠️  Connected but no surf breaks found")
            return False
            
    except Exception as e:
        print(f"❌ Supabase connection failed: {str(e)}")
        return False

def test_deployed_app_api(app_url):
    """Test the deployed app's API endpoint"""
    # Ensure URL has https://
    if not app_url.startswith('http'):
        app_url = f"https://{app_url}"
    
    api_url = f"{app_url}/api/test-db"
    print(f"\n🌐 Testing deployed app API at {api_url}...")
    
    try:
        response = requests.get(api_url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Deployed app API working!")
            print(f"📊 API Response: {data['message']}")
            if 'data' in data:
                print(f"  - Breaks in DB: {data['data']['breaks_count']}")
                print(f"  - Forecasts in DB: {data['data']['forecasts_count']}")
            return True
        else:
            print(f"❌ API returned status {response.status_code}")
            print(f"Response: {response.text[:200]}...")
            return False
            
    except Exception as e:
        print(f"❌ Failed to reach deployed app: {str(e)}")
        return False

def test_willy_weather_api():
    """Test WillyWeather API access"""
    print("\n🌊 Testing WillyWeather API access...")
    
    api_key = os.getenv("WILLY_WEATHER_API_KEY")
    if not api_key:
        print("❌ WILLY_WEATHER_API_KEY not found")
        return False
    
    try:
        # Test with Wollongong
        url = f"https://api.willyweather.com.au/v2/{api_key}/locations/17663/weather.json"
        params = {
            'forecasts': 'swell,wind',
            'days': 1
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ WillyWeather API access successful!")
            print(f"📍 Location: {data.get('location', {}).get('name', 'Unknown')}")
            return True
        else:
            print(f"❌ API returned status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ WillyWeather API test failed: {str(e)}")
        return False

def test_scraper_data_insert():
    """Test inserting sample forecast data"""
    print("\n💾 Testing forecast data insertion...")
    
    try:
        supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY")  # Use service key
        
        if not supabase_url or not supabase_service_key:
            print("❌ Supabase credentials not found")
            return False
        
        supabase: Client = create_client(supabase_url, supabase_service_key)
        
        # Get first surf break for testing
        breaks_response = supabase.table('surf_breaks').select('id').limit(1).execute()
        
        if not breaks_response.data:
            print("❌ No surf breaks found to test with")
            return False
        
        break_id = breaks_response.data[0]['id']
        
        # Insert test forecast data
        test_forecast = {
            'break_id': break_id,
            'forecast_date': '2025-08-01',
            'forecast_time': '6am',
            'swell_height': 1.5,
            'swell_direction': 180,
            'swell_period': 8,
            'wind_speed': 15,
            'wind_direction': 90,
            'tide_height': 1.2
        }
        
        response = supabase.table('forecast_data').upsert(
            test_forecast,
            on_conflict='break_id, forecast_date, forecast_time'
        ).execute()
        
        print("✅ Test forecast data inserted successfully!")
        print(f"📊 Inserted data for break ID: {break_id}")
        return True
        
    except Exception as e:
        print(f"❌ Data insertion test failed: {str(e)}")
        return False

def main():
    print("🧪 Starting Scraper → Deployed App Connection Test\n")
    
    # Test 0: Environment variables
    env_ok = test_env_variables()
    if not env_ok:
        print("\n❌ Environment variables missing. Please check your .env file")
        return
    
    # Test 1: Direct Supabase connection
    supabase_ok = test_supabase_connection()
    
    # Test 2: WillyWeather API
    api_ok = test_willy_weather_api()
    
    # Test 3: Data insertion
    insert_ok = test_scraper_data_insert()
    
    # Test 4: Deployed app API
    print("\n🌐 Testing deployed app API...")
    app_url = "surf-forecast-app-beta.vercel.app"  # Your app URL
    deployed_ok = test_deployed_app_api(app_url)
    
    # Summary
    print(f"\n📋 Test Results Summary:")
    print(f"  Environment Variables: {'✅' if env_ok else '❌'}")
    print(f"  Supabase Connection: {'✅' if supabase_ok else '❌'}")
    print(f"  WillyWeather API: {'✅' if api_ok else '❌'}")
    print(f"  Data Insertion: {'✅' if insert_ok else '❌'}")
    print(f"  Deployed App: {'✅' if deployed_ok else '❌'}")
    
    if all([env_ok, supabase_ok, api_ok, insert_ok, deployed_ok]):
        print("\n🎉 All tests passed! Your scraper should work with the deployed app.")
    else:
        print("\n⚠️  Some tests failed. Check the errors above before running the full scraper.")

if __name__ == "__main__":
    main()