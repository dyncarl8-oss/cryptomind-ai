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
    const symbols = ["GOLD", "QQQ"];
    for (const sym of symbols) {
        // Quote
        const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${API_KEY}`;
        const quoteRes = await testEndpoint(quoteUrl);
        console.log(`Symbol: ${sym} QUOTE`);
        console.log(JSON.stringify(quoteRes, null, 2));

        // Wait to avoid immediate rate limit
        await new Promise(r => setTimeout(r, 2000));

        // History
        const dailyUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${sym}&apikey=${API_KEY}`;
        const dailyRes = await testEndpoint(dailyUrl);
        console.log(`Symbol: ${sym} DAILY`);
        console.log(JSON.stringify(dailyRes, null, 2));

        await new Promise(r => setTimeout(r, 2000));
    }
}

run();
