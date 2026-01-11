import https from 'https';

const symbols = ["BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD"];

symbols.forEach(s => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${s}?interval=1m&range=1d`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, r => {
        let d = ''; r.on('data', c => d += c);
        r.on('end', () => {
            try {
                const res = JSON.parse(d).chart.result[0];
                console.log(`${s}: ${res.meta.regularMarketPrice}`);
            } catch (e) {
                console.log(`${s}: FAIL`);
            }
        });
    });
});
