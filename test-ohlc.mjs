
const symbol = 'BID';
async function test() {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 7200; // Last 2 hours
    const url = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${from}&to=${to}&symbol=${symbol}&resolution=1`;
    console.log('Fetching OHLC:', url);
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const data = await res.json();
        if (data.c && data.c.length > 0) {
            console.log('Latest Price:', data.c[data.c.length - 1]);
            console.log('Latest TS:', new Date(data.t[data.t.length - 1] * 1000).toLocaleString());
            console.log('Data count:', data.c.length);
        } else {
            console.log('No 1m data found. Is the market open?');
            console.log('Full response:', JSON.stringify(data, null, 2));
        }
    } catch (e) { console.error('Error:', e); }
}
test();
