
const symbol = 'BID';
async function test() {
    // TCBS API
    const url = `https://api.tcbs.com.vn/market/v1/ticker-price?ticker=${symbol}`;
    console.log('Fetching TCBS:', url);
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const data = await res.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (e) { console.error('Error:', e); }
}
test();
