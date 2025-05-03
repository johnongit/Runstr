/**
 * Bitvora API Integration Test
 * 
 * This tests the integration with Bitvora API and helps verify our implementation.
 * 
 * To run this test:
 * 1. Open a terminal
 * 2. Navigate to the project root
 * 3. Run: node src/tests/bitvoraIntegration.mjs
 */

import axios from 'axios';

// API configuration
const BITVORA_API_URL = 'https://api.bitvora.com/v1';
// Try different formats of the key
const API_KEY_ORIGINAL = '31651aad-632f-4162-8eb9-d6146587d497';
const API_KEY_WITH_PREFIX = `sk_${API_KEY_ORIGINAL}`;

// Create different axios instances to test different key formats
const bitvoraApi = axios.create({
  baseURL: BITVORA_API_URL,
  headers: {
    'Authorization': `Bearer ${API_KEY_ORIGINAL}`,
    'Content-Type': 'application/json'
  }
});

const bitvoraApiWithPrefix = axios.create({
  baseURL: BITVORA_API_URL,
  headers: {
    'Authorization': `Bearer ${API_KEY_WITH_PREFIX}`,
    'Content-Type': 'application/json'
  }
});

// Test public key (a valid Nostr or Lightning address would be required for actual tests)
const TEST_PUB_KEY = 'test_user@bitvora.me';

// Helper function to display detailed error information
const logDetailedError = (error, operation) => {
  console.error(`Error during ${operation}:`);
  
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    console.error(`  Status: ${error.response.status}`);
    console.error(`  Status Text: ${error.response.statusText}`);
    console.error('  Headers:', JSON.stringify(error.response.headers, null, 2));
    console.error('  Response Data:', JSON.stringify(error.response.data, null, 2));
  } else if (error.request) {
    // The request was made but no response was received
    console.error('  No response received from server');
    console.error('  Request info:', error.request._header || error.request);
  } else {
    // Something happened in setting up the request that triggered an Error
    console.error('  Error message:', error.message);
  }
  
  if (error.config) {
    console.error('  Request Config:');
    console.error(`    Method: ${error.config.method}`);
    console.error(`    URL: ${error.config.baseURL}${error.config.url}`);
    console.error('    Headers:', JSON.stringify(error.config.headers, null, 2));
    if (error.config.data) {
      console.error('    Data:', error.config.data);
    }
  }
};

// Simple test runner
async function runTests() {
  console.log('🧪 Running Bitvora integration tests...');
  
  try {
    // 1. Test connection with original key
    console.log('\n🔄 Testing API connection with original key...');
    try {
      const response = await bitvoraApi.get('/transactions/balance');
      console.log('  Result:', {
        valid: true,
        balance: response.data.data.balance,
        message: 'Connection successful'
      });
    } catch (error) {
      logDetailedError(error, 'API connection test (original key)');
      console.log('\n🔄 Testing API connection with different key format (sk_ prefix)...');
      
      try {
        const response = await bitvoraApiWithPrefix.get('/transactions/balance');
        console.log('  Result:', {
          valid: true,
          balance: response.data.data.balance,
          message: 'Connection successful with sk_ prefix'
        });
      } catch (prefixError) {
        logDetailedError(prefixError, 'API connection test (sk_ prefix)');
        
        // Try a different endpoint to check if the API is working
        console.log('\n🔄 Testing another endpoint (health check)...');
        try {
          // Some APIs have a health check endpoint that doesn't require authentication
          const healthResponse = await axios.get(`${BITVORA_API_URL}/health`);
          console.log('  Health check result:', healthResponse.data);
        } catch (healthError) {
          logDetailedError(healthError, 'API health check');
          throw new Error('API connection failed with all attempts');
        }
      }
    }
    
    console.log('\n✅ Connection tests completed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Run the tests
runTests(); 