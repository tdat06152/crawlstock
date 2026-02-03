
const symbol = 'BID';
async function test() {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 3600;
    const url = `https://m.vndirect.com.vn/flashchart/history?symbol=${symbol}&resolution=1&from=${from}&to=${to}`;
    console.log('Fetching VNDIRECT Flashchart:', url);
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const data = await res.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (e) { console.error('Error:', e); }
}
test();
