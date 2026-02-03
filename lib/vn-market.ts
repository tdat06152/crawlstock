export interface StockPrice {
    symbol: string;
    price: number;
    timestamp: string;
}

export class VNMarketClient {
    private baseUrl = 'https://services.entrade.com.vn/chart-api/v2/ohlcs/stock';

    /**
     * Fetch the latest price for a symbol from Entrade OHLC API
     */
    async getLatestPrice(symbol: string): Promise<StockPrice | null> {
        try {
            const to = Math.floor(Date.now() / 1000);
            // Fetch last 2 hours to be safe and get the latest 1m candles
            const from = to - (2 * 60 * 60);

            const url = new URL(this.baseUrl);
            url.searchParams.append('from', from.toString());
            url.searchParams.append('to', to.toString());
            url.searchParams.append('symbol', symbol);
            url.searchParams.append('resolution', '1');

            console.log(`[VNMarket] Fetching ${symbol}...`);

            const response = await fetch(url.toString(), {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json'
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                console.error(`Error fetching ${symbol}: ${response.status}`);
                return null;
            }

            const data = await response.json();

            // Entrade Structure: { "t": [timestamps], "c": [closes], ... }
            if (!data.c || data.c.length === 0) {
                console.warn(`No candle data for ${symbol}`);
                return null;
            }

            const latestPrice = data.c[data.c.length - 1];
            const latestTs = data.t[data.t.length - 1];

            console.log(`[VNMarket] ${symbol} => ${latestPrice} at ${new Date(latestTs * 1000).toISOString()}`);

            return {
                symbol,
                price: latestPrice,
                timestamp: new Date(latestTs * 1000).toISOString()
            };

        } catch (error) {
            console.error(`Error fetching price for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Fetch prices for multiple symbols (serial execution to be safe)
     */
    async getLatestPrices(symbols: string[]): Promise<StockPrice[]> {
        const results: StockPrice[] = [];

        for (const symbol of symbols) {
            const price = await this.getLatestPrice(symbol);
            if (price) {
                results.push(price);
            }
            // Small delay to be nice to the public API
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        return results;
    }
}
