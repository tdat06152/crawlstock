
const symbols = ['BID', 'STB'];
async function test() {
    for (const symbol of symbols) {
        const to = Math.floor(Date.now() / 1000);
        const from = to - 7200;
        const url = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${from}&to=${to}&symbol=${symbol}&resolution=1`;
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const data = await res.json();
            if (data.c && data.c.length > 0) {
                console.log(`${symbol} => Price: ${data.c[data.c.length - 1]}, TS: ${new Date(data.t[data.t.length - 1] * 1000).toLocaleString()}`);
            } else {
                console.log(`${symbol} => No data`);
            }
        } catch (e) { console.error(`Error ${symbol}:`, e); }
    }
}
test();
