import https from 'https';
https.get(`https://min-api.cryptocompare.com/data/generateAvg?fsym=PAXG&tsym=USDT&e=CCCAGG`, r => {
    let d = ''; r.on('data', c => d += c);
    r.on('end', () => console.log(d));
});
