export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const securityKey = request.headers.get('X-Security-Key');
    if (securityKey !== env.SECURITY_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const data = await request.json();
      const signal = data.signal;

      const timestamp = Math.floor(Date.now() / 1000);
      const method = 'POST';
      const requestPath = '/api/v3/brokerage/orders';
      const orderBody = JSON.stringify({
        product_id: 'BTC-USD',
        side: signal === 'Buy' || signal === 'buy' ? 'BUY' : 'SELL',
        order_type: 'MARKET',
        market_market_ioc: {
          quote_size: '50'
        }
      });

      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(env.COINBASE_API_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const message = timestamp + method + requestPath + orderBody;
      const messageBuffer = new TextEncoder().encode(message);
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageBuffer);
      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

      const coinbaseResponse = await fetch('https://api.coinbase.com' + requestPath, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.COINBASE_API_KEY}`,
          'CB-ACCESS-SIGN': signature,
          'CB-ACCESS-TIMESTAMP': timestamp.toString(),
          'Content-Type': 'application/json'
        },
        body: orderBody
      });

      const responseText = await coinbaseResponse.text();
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Coinbase API returned invalid JSON',
          raw_response: responseText.substring(0, 500),
          status_code: coinbaseResponse.status
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!coinbaseResponse.ok) {
        return new Response(JSON.stringify({
          success: false,
          error: result.message || result.error_details || 'Coinbase API error',
          details: result
        }), {
          status: coinbaseResponse.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: `$50 ${signal} order executed`,
        orderId: result.order_id || result.id,
        order: result
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
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
