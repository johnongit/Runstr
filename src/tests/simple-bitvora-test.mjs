/**
 * Simple Bitvora API Test
 * Using exact format from documentation
 */

import axios from 'axios';

// API key directly from the documentation example
const apiKey = '31651aad-632f-4162-8eb9-d6146587d497';

async function runSimpleTest() {
  console.log('Running simple Bitvora API test using documentation format...');
  
  try {
    // Using the exact format from the documentation
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
      console.error('Response data:', error.response.data);
    }
  }
}

runSimpleTest(); 