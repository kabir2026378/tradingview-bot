export default {
  async fetch(request, env) {
    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Security check - verify API key
    const securityKey = request.headers.get('X-Security-Key');
    if (securityKey !== env.SECURITY_KEY) {
      console.error('Invalid security key');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const data = await request.json();
      const signal = data.signal;
      
      console.log(`[${new Date().toISOString()}] Received signal: ${signal}`);

      // Prepare Coinbase order
      const timestamp = Math.floor(Date.now() / 1000);
      const method = 'POST';
      const requestPath = '/api/v1/orders';
      const orderBody = JSON.stringify({
        product_id: 'BTC-USD',
        side: signal === 'Buy' || signal === 'buy' ? 'buy' : 'sell',
        order_type: 'market',
        funds: '50'
      });

      // Create HMAC signature
      const secretBuffer = Uint8Array.from(atob(env.COINBASE_API_SECRET), c => c.charCodeAt(0));
      const key = await crypto.subtle.importKey(
        'raw',
        secretBuffer,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const message = timestamp + method + requestPath + orderBody;
      const messageBuffer = new TextEncoder().encode(message);
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageBuffer);
      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

      // Call Coinbase API
      const coinbaseResponse = await fetch('https://api.coinbase.com' + requestPath, {
        method: 'POST',
        headers: {
          'CB-ACCESS-KEY': env.COINBASE_API_KEY,
          'CB-ACCESS-SIGN': signature,
          'CB-ACCESS-TIMESTAMP': timestamp.toString(),
          'CB-ACCESS-PASSPHRASE': env.COINBASE_PASSPHRASE,
          'Content-Type': 'application/json'
        },
        body: orderBody
      });

      const result = await coinbaseResponse.json();
      
      console.log(`[${new Date().toISOString()}] Coinbase response:`, result);

      if (!coinbaseResponse.ok) {
        return new Response(JSON.stringify({
          success: false,
          error: result.message || 'Coinbase API error',
          details: result
        }), {
          status: coinbaseResponse.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: `$50 ${signal} order executed`,
        orderId: result.id,
        order: result
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error:`, error.message);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};