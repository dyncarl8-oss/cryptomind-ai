import https from 'https';
const pairs = [
    { f: "XAU", t: "USD" },
    { f: "PAXG", t: "USDT" },
    { f: "US100", t: "USD" },
    { f: "NDX", t: "USD" }
];
pairs.forEach(p => {
    https.get(`https://min-api.cryptocompare.com/data/price?fsym=${p.f}&tsyms=${p.t}`, r => {
        let d = ''; r.on('data', c => d += c);
        r.on('end', () => console.log(`${p.f}/${p.t}: ${d}`));
    });
});
