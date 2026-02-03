
const symbol = 'BID';
const to = Math.floor(Date.now() / 1000);
const from = to - (7 * 24 * 60 * 60);

async function test() {
    const url = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${from}&to=${to}&symbol=${symbol}&resolution=1D`;
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
