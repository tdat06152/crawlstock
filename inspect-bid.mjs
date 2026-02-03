
const symbol = 'BID';
const to = Math.floor(Date.now() / 1000);
const from = to - (24 * 60 * 60);

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
        console.log('Number of points:', data.c.length);
        console.log('First point (of the day?):', {
            t: new Date(data.t[0] * 1000).toLocaleString(),
            o: data.o[0],
            c: data.c[0],
            h: data.h[0],
            l: data.l[0]
        });
        console.log('Latest point:', {
            t: new Date(data.t[data.t.length - 1] * 1000).toLocaleString(),
            o: data.o[data.o.length - 1],
            c: data.c[data.c.length - 1],
            h: data.h[data.h.length - 1],
            l: data.l[data.l.length - 1]
        });

        // Check for any price around 50
        const minPrice = Math.min(...data.l);
        console.log('Min price in range:', minPrice);
    } else {
        console.log('No data found');
    }
}

test();
