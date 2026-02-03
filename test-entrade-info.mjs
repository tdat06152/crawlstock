
const symbol = 'BID';
async function test() {
    const url = `https://api.entrade.com.vn/api/stock-info/${symbol}`;
    console.log('Fetching Entrade Price API:', url);
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const data = await res.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (e) { console.error('Error:', e); }
}
test();
