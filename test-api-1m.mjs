
const symbol = 'BID';
const to = Math.floor(Date.now() / 1000);
const from = to - (1 * 24 * 60 * 60); // Last 24 hours

async function test() {
    const url = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${from}&to=${to}&symbol=${symbol}&resolution=1`;
    console.log('Fetching:', url);
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0'
        }
    });
    const data = await response.json();
    if (data.c && data.c.length > 0) {
        console.log('Latest Price:', data.c[data.c.length - 1]);
        console.log('Latest Timestamp:', new Date(data.t[data.t.length - 1] * 1000).toLocaleString());
    } else {
        console.log('No data found');
    }
}

test();
