import fetch from 'node-fetch';

async function testAPIEndpoints() {
  const baseURL = 'http://localhost:3000';
  
  console.log('Testing API endpoints...\n');
  
  // Test users endpoint
  try {
    const usersRes = await fetch(`${baseURL}/api/admin/management/users`);
    console.log('Users endpoint status:', usersRes.status);
    if (usersRes.ok) {
      const usersData = await usersRes.json();
      console.log('Users count:', usersData.length);
    }
  } catch (error) {
    console.log('Users endpoint error:', error.message);
  }
  
  // Test reviews endpoint
  try {
    const reviewsRes = await fetch(`${baseURL}/api/review/admin/stats`);
    console.log('Reviews endpoint status:', reviewsRes.status);
    if (reviewsRes.ok) {
      const reviewsData = await reviewsRes.json();
      console.log('Reviews data:', reviewsData);
    }
  } catch (error) {
    console.log('Reviews endpoint error:', error.message);
  }
  
  // Test listings endpoint
  try {
    const listingsRes = await fetch(`${baseURL}/api/listing/get`);
    console.log('Listings endpoint status:', listingsRes.status);
    if (listingsRes.ok) {
      const listingsData = await listingsRes.json();
      console.log('Listings count:', listingsData.length);
    }
  } catch (error) {
    console.log('Listings endpoint error:', error.message);
  }
  
  // Test bookings endpoint
  try {
    const bookingsRes = await fetch(`${baseURL}/api/bookings`);
    console.log('Bookings endpoint status:', bookingsRes.status);
    if (bookingsRes.ok) {
      const bookingsData = await bookingsRes.json();
      console.log('Bookings count:', bookingsData.length);
    }
  } catch (error) {
    console.log('Bookings endpoint error:', error.message);
  }
  
  // Test booking stats endpoint
  try {
    const bookingStatsRes = await fetch(`${baseURL}/api/bookings/stats`);
    console.log('Booking stats endpoint status:', bookingStatsRes.status);
    if (bookingStatsRes.ok) {
      const bookingStatsData = await bookingStatsRes.json();
      console.log('Booking stats data:', bookingStatsData);
    }
  } catch (error) {
    console.log('Booking stats endpoint error:', error.message);
  }
}

testAPIEndpoints(); 