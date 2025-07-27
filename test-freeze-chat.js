const fetch = require('node-fetch');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = 'test@admin.com';
const ADMIN_PASSWORD = 'admin123';

async function testFreezeChatFunctionality() {
  try {
    console.log('🚀 Testing Freeze Chat Functionality...\n');

    // Step 1: Admin login
    console.log('1. Logging in as admin...');
    const loginRes = await fetch(`${API_BASE_URL}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      })
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status}`);
    }

    const loginData = await loginRes.json();
    const cookies = loginRes.headers.get('set-cookie');
    console.log('✅ Admin login successful\n');

    // Step 2: Get all appointments
    console.log('2. Fetching appointments...');
    const appointmentsRes = await fetch(`${API_BASE_URL}/api/bookings`, {
      headers: { Cookie: cookies }
    });

    if (!appointmentsRes.ok) {
      throw new Error(`Failed to fetch appointments: ${appointmentsRes.status}`);
    }

    const appointments = await appointmentsRes.json();
    console.log(`✅ Found ${appointments.length} appointments\n`);

    if (appointments.length === 0) {
      console.log('ℹ️ No appointments found to test with');
      return;
    }

    const testAppointment = appointments[0];
    console.log(`📋 Testing with appointment ID: ${testAppointment._id}`);
    console.log(`   Property: ${testAppointment.propertyName}`);
    console.log(`   Current chat frozen status: ${testAppointment.chatFrozen || false}\n`);

    // Step 3: Test freeze chat
    console.log('3. Testing freeze chat...');
    const freezeRes = await fetch(`${API_BASE_URL}/api/bookings/${testAppointment._id}/freeze-chat`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        Cookie: cookies 
      }
    });

    if (!freezeRes.ok) {
      const errorData = await freezeRes.json();
      console.log(`❌ Freeze failed: ${errorData.message}`);
    } else {
      const freezeData = await freezeRes.json();
      console.log('✅ Chat frozen successfully');
      console.log(`   Message: ${freezeData.message}`);
      console.log(`   Frozen by: ${freezeData.chatFrozenBy}`);
      console.log(`   Frozen at: ${freezeData.chatFrozenAt}\n`);
    }

    // Step 4: Test unfreeze chat
    console.log('4. Testing unfreeze chat...');
    const unfreezeRes = await fetch(`${API_BASE_URL}/api/bookings/${testAppointment._id}/unfreeze-chat`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        Cookie: cookies 
      }
    });

    if (!unfreezeRes.ok) {
      const errorData = await unfreezeRes.json();
      console.log(`❌ Unfreeze failed: ${errorData.message}`);
    } else {
      const unfreezeData = await unfreezeRes.json();
      console.log('✅ Chat unfrozen successfully');
      console.log(`   Message: ${unfreezeData.message}\n`);
    }

    // Step 5: Test adding comment when frozen
    console.log('5. Testing comment posting when chat is frozen...');
    
    // First freeze the chat
    await fetch(`${API_BASE_URL}/api/bookings/${testAppointment._id}/freeze-chat`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        Cookie: cookies 
      }
    });

    // Try to post a comment as admin (should work)
    const adminCommentRes = await fetch(`${API_BASE_URL}/api/bookings/${testAppointment._id}/comment`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Cookie: cookies 
      },
      body: JSON.stringify({
        message: 'Test admin message while chat is frozen'
      })
    });

    if (adminCommentRes.ok) {
      console.log('✅ Admin can send messages when chat is frozen');
    } else {
      const errorData = await adminCommentRes.json();
      console.log(`❌ Admin comment failed: ${errorData.message}`);
    }

    // Clean up - unfreeze the chat
    await fetch(`${API_BASE_URL}/api/bookings/${testAppointment._id}/unfreeze-chat`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        Cookie: cookies 
      }
    });

    console.log('\n🎉 Freeze chat functionality test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testFreezeChatFunctionality();