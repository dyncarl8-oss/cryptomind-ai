import https from 'https';

const API_KEY = "9EWIX673WCGVHWK0";

async function testEndpoint(url) {
    console.log(`Testing: ${url}`);
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ error: "Parse error", raw: data.substring(0, 100) });
                }
            });
        }).on('error', (e) => resolve({ error: e.message }));
    });
}

async function run() {
    const tests = [
        // Real-time FX (Gold is often tracked via XAU/USD in FX)
        `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=XAU&to_currency=USD&apikey=${API_KEY}`,
        // Intraday FX (Historical)
        `https://www.alphavantage.co/query?function=FX_INTRADAY&from_symbol=XAU&to_symbol=USD&interval=15min&apikey=${API_KEY}`,
        // Nasdaq 100 (often not available for free tier or as symbol ^NDX)
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=NDX&apikey=${API_KEY}`,
        // Trial NDX as well
        `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=NDX&interval=15min&apikey=${API_KEY}`
    ];

    for (const url of tests) {
        const res = await testEndpoint(url);
        console.log(JSON.stringify(res, null, 2));
        console.log('---');
    }
}

run();
