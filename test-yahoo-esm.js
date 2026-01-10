import https from 'https';
const symbols = ["GC=F", "XAUUSD=X", "^NDX", "NQ=F"];
symbols.forEach(s => {
    https.get(`https://query1.finance.yahoo.com/v8/finance/chart/${s}?interval=1m&range=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' } }, r => {
        let d = ''; r.on('data', c => d += c);
        r.on('end', () => {
            try {
                const res = JSON.parse(d).chart.result[0];
                console.log(`${s}: ${res.meta.regularMarketPrice} (${res.meta.marketState})`);
            } catch (e) { console.log(`${s}: ERR`); }
        });
    });
});
