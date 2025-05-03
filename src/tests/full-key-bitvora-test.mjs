/**
 * Bitvora API Test with Full API Key
 * Using the complete API key format
 */

import axios from 'axios';

// API key with full format including prefix
const apiKey = '48|31651aad-632f-4162-8eb9-d6146587d497';

async function runTest() {
  console.log('Running Bitvora API test with FULL API key format...');
  
  try {
    // Using the exact format from the documentation but with full key
    const response = await axios.get('https://api.bitvora.com/v1/transactions/balance', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    
    console.log('Success! Response:', response.data);
  } catch (error) {
    console.error('Error:', error.message);
    
    // Show detailed error information
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received. Request:', error.request._header || 'No request header');
    }
    
    console.error('Request config:', {
      method: error.config?.method,
      url: error.config?.url,
      headers: error.config?.headers
    });
  }
}

runTest(); 