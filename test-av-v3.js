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
                    resolve({ error: "Parse error" });
                }
            });
        }).on('error', (e) => resolve({ error: e.message }));
    });
}

async function run() {
    // Test FX Intraday for XAU/USD
    const fxUrl = `https://www.alphavantage.co/query?function=FX_INTRADAY&from_symbol=XAU&to_symbol=USD&interval=60min&apikey=${API_KEY}`;
    const fxRes = await testEndpoint(fxUrl);
    console.log("XAU/USD FX INTRADAY:");
    console.log(JSON.stringify(fxRes, null, 2));

    await new Promise(r => setTimeout(r, 2000));

    // Test Commodity Gold
    const goldUrl = `https://www.alphavantage.co/query?function=GOLD&apikey=${API_KEY}`;
    const goldRes = await testEndpoint(goldUrl);
    console.log("COMMODITY GOLD:");
    console.log(JSON.stringify(goldRes, null, 2));
}

run();
