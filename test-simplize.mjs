
const symbol = 'BID';
async function test() {
    // Simplize API
    const url = `https://price.simplize.vn/api/v1/stock/quote/${symbol}`;
    console.log('Fetching Simplize:', url);
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const data = await res.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (e) { console.error('Error:', e); }
}
test();
