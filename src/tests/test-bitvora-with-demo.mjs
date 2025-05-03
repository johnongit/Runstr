/**
 * Test Bitvora integration with DEMO_MODE enabled
 * This script tests our services with demo data
 */

// We need to use dynamic imports to handle ESM files properly
async function runTest() {
  try {
    console.log('🧪 Testing Bitvora integration with DEMO_MODE enabled...');

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
      console.log('  Transactions retrieved:', txResult.transactions.length);
      console.log('  First transaction:', txResult.transactions[0]);
    } else {
      console.error('  Failed to get transactions:', txResult.error);
    }
    
    // 4. Test lightning address creation
    console.log('\n⚡ Creating lightning address...');
    const addressResult = await bitvoraService.createLightningAddress({
      source: 'test',
      timestamp: new Date().toISOString()
    });
    
    if (addressResult.success) {
      console.log('  Lightning address created:', addressResult.address);
    } else {
      console.error('  Failed to create lightning address:', addressResult.error);
    }
    
    // 5. Test lightning invoice creation
    console.log('\n🧾 Creating lightning invoice...');
    const invoiceResult = await bitvoraService.createLightningInvoice(
      1000, // 1000 sats
      'Test invoice',
      3600,
      { source: 'test' }
    );
    
    if (invoiceResult.success) {
      console.log('  Invoice created with ID:', invoiceResult.id);
      console.log('  Invoice amount:', invoiceResult.amount, 'sats');
      
      // 6. Test checking invoice status
      console.log('\n🔍 Checking invoice status...');
      const statusResult = await bitvoraService.checkInvoiceStatus(invoiceResult.id);
      console.log('  Invoice status:', statusResult.settled ? 'Settled' : 'Pending');
    } else {
      console.error('  Failed to create invoice:', invoiceResult.error);
    }
    
    // 7. Test sending Bitcoin
    console.log('\n📤 Sending Bitcoin...');
    const sendResult = await bitvoraService.sendBitcoin(
      'test@bitvora.me',
      500, // 500 sats
      'Test payment',
      { source: 'test' }
    );
    
    if (sendResult.success) {
      console.log('  Payment sent with ID:', sendResult.txid);
      console.log('  Amount sent:', sendResult.amount, 'sats');
      console.log('  Fee:', sendResult.fee, 'sats');
      
      // 8. Test checking payment status
      console.log('\n🔍 Checking payment status...');
      const paymentStatusResult = await bitvoraService.checkPaymentStatus(sendResult.txid);
      console.log('  Payment status:', paymentStatusResult.status);
    } else {
      console.error('  Failed to send payment:', sendResult.error);
    }
    
    console.log('\n✅ All tests completed successfully in DEMO_MODE!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

runTest(); 