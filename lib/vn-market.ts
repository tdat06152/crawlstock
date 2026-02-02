export interface StockPrice {
    symbol: string;
    price: number;
    timestamp: string;
}

export class VNMarketClient {
    private baseUrl = 'https://services.entrade.com.vn/chart-api/v2/ohlcs/stock';

    /**
     * Fetch the latest price for a symbol from Entrade API
     */
    async getLatestPrice(symbol: string): Promise<StockPrice | null> {
        try {
            const to = Math.floor(Date.now() / 1000);
            const from = to - (7 * 24 * 60 * 60); // Look back 7 days to ensure we get data even on weekends/holidays

            const url = new URL(this.baseUrl);
            url.searchParams.append('from', from.toString());
            url.searchParams.append('to', to.toString());
            url.searchParams.append('symbol', symbol);
            url.searchParams.append('resolution', '1D'); // Daily resolution is stable

            const response = await fetch(url.toString(), {
                headers: {
                    'User-Agent': 'Mozilla/5.0' // Required by some WAFs
                }
            });

            if (!response.ok) {
                console.error(`Error fetching ${symbol}: ${response.status} ${response.statusText}`);
                return null;
            }

            const data = await response.json();

            // Check if data exists
            if (!data || !data.c || data.c.length === 0) {
                console.warn(`No data found for ${symbol}`);
                return null;
            }

            // Get the latest close price
            const latestPrice = data.c[data.c.length - 1];
            const latestTimestamp = data.t[data.t.length - 1];

            return {
                symbol,
                price: latestPrice,
                timestamp: new Date(latestTimestamp * 1000).toISOString()
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
