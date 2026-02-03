
const symbol = 'BID';
async function test() {
    const url = `https://services.entrade.com.vn/chart-api/v2/plaintext/quotes/stock/SI/${symbol}`;
    console.log('Fetching:', url);
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0'
        }
    });
    const data = await response.json();
    console.log('Data:', JSON.stringify(data, null, 2));
}
test();
