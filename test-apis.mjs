
const symbol = 'BID';
async function test() {
    // API 1: Tickers
    const url1 = `https://api.dnse.com.vn/market-api/tickers?symbol=${symbol}`;
    console.log('Fetching API 1:', url1);
    try {
        const res1 = await fetch(url1, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const data1 = await res1.json();
        console.log('API 1 Response:', JSON.stringify(data1, null, 2));
    } catch (e) { console.error('API 1 Error:', e); }

    // API 2: DNSE Quotes (Public/No Auth check)
    const url2 = `https://services.entrade.com.vn/dnse-market-info-service/prices/quotes?symbols=${symbol}`;
    console.log('\nFetching API 2:', url2);
    try {
        const res2 = await fetch(url2, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const data2 = await res2.json();
        console.log('API 2 Response:', JSON.stringify(data2, null, 2));
    } catch (e) { console.error('API 2 Error:', e); }
}
test();
