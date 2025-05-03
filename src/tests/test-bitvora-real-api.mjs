/**
 * Test Bitvora integration with REAL API
 * This script tests our services with the actual Bitvora API
 */

// We need to use dynamic imports to handle ESM files properly
async function runTest() {
  try {
    console.log('🧪 Testing Bitvora integration with REAL API...');

    // Import services dynamically
    const { default: bitvoraService } = await import('../services/bitvoraService.js');
    
    // 1. Test connection
    console.log('\n🔄 Testing connection...');
    const connectionResult = await bitvoraService.checkConnection();
    console.log('  Result:', connectionResult);
    
    if (!connectionResult.valid) {
      throw new Error('Connection failed');
    }
    
    // 2. Test balance
    console.log('\n💰 Checking balance...');
    const balance = await bitvoraService.getBalance();
    console.log('  Balance:', balance, 'sats');
    
    // 3. Test transaction listing
    console.log('\n📋 Getting transactions...');
    const txResult = await bitvoraService.getTransactions();
    
    if (txResult.success) {
      console.log('  Transactions retrieved:', txResult.transactions?.length || 0);
      if (txResult.transactions && txResult.transactions.length > 0) {
        console.log('  First transaction:', txResult.transactions[0]);
      }
    } else {
      console.error('  Failed to get transactions:', txResult.error);
    }
    
    // Only do non-destructive tests that don't spend money
    
    console.log('\n✅ API tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

runTest(); 