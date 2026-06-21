import express from 'express';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/', async (req, res) => {
  try {
    const data = req.body;
    const signal = data.signal;
    const securityKey = data.securityKey;

    // Verify security key
    if (securityKey !== process.env.SECURITY_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const method = 'POST';
    const requestPath = '/api/v3/brokerage/orders';
    const orderBody = JSON.stringify({
      product_id: 'XLM-USDC',
      side: signal === 'Buy' || signal === 'buy' ? 'BUY' : 'SELL',
      order_type: 'MARKET',
      market_market_ioc: {
        quote_size: '5'
      }
    });

    const message = timestamp + method + requestPath + orderBody;
    const signature = crypto
      .createHmac('sha256', process.env.COINBASE_API_SECRET)
      .update(message)
      .digest('base64');

    const coinbaseResponse = await fetch('https://api.coinbase.com' + requestPath, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.COINBASE_API_KEY}`,
        'CB-ACCESS-SIGN': signature,
        'CB-ACCESS-TIMESTAMP': timestamp.toString(),
        'Content-Type': 'application/json'
      },
      body: orderBody
    });

    const result = await coinbaseResponse.json();

    if (!coinbaseResponse.ok) {
      return res.status(coinbaseResponse.status).json({
        success: false,
        error: result.message || 'Coinbase API error',
        details: result
      });
    }

    res.json({
      success: true,
      message: `$5 ${signal} order executed on XLM-USDC`,
      orderId: result.order_id || result.id
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
