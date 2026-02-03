
const symbol = 'BID';
const to = Math.floor(Date.now() / 1000);
const from = to - (30 * 24 * 60 * 60); // 30 days

async function test() {
    const url = `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${from}&to=${to}&symbol=${symbol}&resolution=1D`;
    console.log('Fetching:', url);
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0'
        }
    });
    const data = await response.json();
    if (data.c && data.c.length > 0) {
        data.c.forEach((p, i) => {
            console.log(`${new Date(data.t[i] * 1000).toLocaleDateString()}: ${p}`);
        });
    } else {
        console.log('No data found');
    }
}

test();
