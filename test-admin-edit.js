import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testAdminEditListing() {
  try {
    console.log('Testing admin edit listing functionality...\n');

    // First, let's get a listing to edit
    console.log('1. Fetching a listing to edit...');
    const getListingRes = await fetch(`${BASE_URL}/api/listing/get`);
    const listings = await getListingRes.json();
    
    if (listings.length === 0) {
      console.log('No listings found to test with');
      return;
    }

    const testListing = listings[0];
    console.log(`Found listing: ${testListing.name} (ID: ${testListing._id})`);

    // Test updating the listing (this would normally require admin login)
    console.log('\n2. Testing update endpoint...');
    const updateData = {
      name: testListing.name + ' (Updated by Admin)',
      description: testListing.description + ' - Updated by admin',
      address: testListing.address,
      type: testListing.type,
      bedrooms: testListing.bedrooms,
      bathrooms: testListing.bathrooms,
      regularPrice: testListing.regularPrice,
      discountPrice: testListing.discountPrice,
      offer: testListing.offer,
      parking: testListing.parking,
      furnished: testListing.furnished,
      imageUrls: testListing.imageUrls,
      locationLink: testListing.locationLink
    };

    const updateRes = await fetch(`${BASE_URL}/api/listing/update/${testListing._id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });

    if (updateRes.ok) {
      console.log('✅ Update endpoint is accessible');
    } else {
      const errorData = await updateRes.json();
      console.log(`❌ Update failed: ${errorData.message}`);
    }

    console.log('\n✅ Admin edit listing test completed');
    console.log('\nNote: This test only checks endpoint accessibility.');
    console.log('Full functionality requires admin authentication.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAdminEditListing(); 