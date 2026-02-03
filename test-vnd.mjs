
const symbol = 'BID';
async function test() {
    // VNDIRECT API
    const url = `https://price-service.vndirect.com.vn/snapshot/q=codes:${symbol}`;
    console.log('Fetching VNDIRECT:', url);
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const data = await res.json();
        console.log('VNDIRECT Response:', JSON.stringify(data, null, 2));
    } catch (e) { console.error('Error:', e); }
}
test();
