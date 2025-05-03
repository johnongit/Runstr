/**
 * Bitvora API Integration Test
 * 
 * This tests the integration with Bitvora API and helps verify our implementation.
 * 
 * To run this test:
 * 1. Open a terminal
 * 2. Navigate to the project root
 * 3. Run: node src/tests/bitvoraIntegration.test.js
 */

import bitvoraService from '../services/bitvoraService.js';
import transactionService, { TRANSACTION_TYPES } from '../services/transactionService.js';

// Test public key (a valid Nostr or Lightning address would be required for actual tests)
const TEST_PUB_KEY = 'test_user@bitvora.me';

// Simple test runner
async function runTests() {
  console.log('🧪 Running Bitvora integration tests...');
  
  try {
    // 1. Test connection
    console.log('\n🔄 Testing API connection...');
    const connectionResult = await bitvoraService.checkConnection();
    console.log('  Result:', connectionResult);
    
    if (!connectionResult.valid) {
      throw new Error('API connection failed: ' + connectionResult.message);
    }
    
    // 2. Test balance check
    console.log('\n💰 Checking balance...');
    const balance = await bitvoraService.getBalance();
    console.log('  Balance:', balance, 'sats');
    
    // 3. Test transaction listing
    console.log('\n📋 Getting transactions...');
    const transactions = await bitvoraService.getTransactions();
    console.log('  Transaction count:', transactions.success ? transactions.transactions.length : 0);
    
    // 4. Test lightning address creation
    console.log('\n⚡ Creating lightning address...');
    const lightningAddressResult = await bitvoraService.createLightningAddress({
      source: 'integration_test',
      timestamp: new Date().toISOString()
    });
    console.log('  Result:', lightningAddressResult);
    
    // Only test Bitcoin sending if specifically enabled (to avoid spending real Bitcoin)
    const ENABLE_SEND_TESTS = false;
    
    if (ENABLE_SEND_TESTS) {
      // 5. Test Bitcoin sending
      console.log('\n📤 Testing Bitcoin sending (small amount)...');
      const sendResult = await bitvoraService.sendBitcoin(
        TEST_PUB_KEY,
        10, // Just 10 sats for testing
        'Integration test payment',
        { source: 'integration_test' }
      );
      console.log('  Result:', sendResult);
      
      if (sendResult.success) {
        // 6. Test payment status check
        console.log('\n🔍 Checking payment status...');
        const statusResult = await bitvoraService.checkPaymentStatus(sendResult.txid);
        console.log('  Result:', statusResult);
      }
    } else {
      console.log('\n📤 Bitcoin sending tests disabled to avoid spending real funds.');
    }
    
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  }
}

// Run the tests
runTests(); 