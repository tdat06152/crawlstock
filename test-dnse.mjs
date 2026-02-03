
const symbols = 'BID,STB';
async function test() {
    const url = `https://services.entrade.com.vn/dnse-market-info-service/prices/quotes?symbols=${symbols}`;
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
