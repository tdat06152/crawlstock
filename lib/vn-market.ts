export interface StockPrice {
    symbol: string;
    price: number;
    timestamp: string;
}

export class VNMarketClient {
    private baseUrl = 'https://api.dnse.com.vn/market-api/v2/quotes';

    /**
     * Fetch the real-time quote from DNSE Market API
     */
    async getLatestPrice(symbol: string): Promise<StockPrice | null> {
        try {
            const url = new URL(this.baseUrl);
            url.searchParams.append('symbols', symbol);

            console.log(`[DNSE] Fetching real-time: ${symbol}...`);

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

            const json = await response.json();

            // DNSE Structure: { "data": [ { "symbol": "BID", "lastPrice": 55.1, ... } ] }
            const data = json.data?.[0];

            if (!data || data.lastPrice === undefined) {
                console.warn(`No real-time data for ${symbol}`);
                return null;
            }

            const latestPrice = data.lastPrice;
            console.log(`[DNSE] ${symbol} => ${latestPrice}`);

            return {
                symbol,
                price: latestPrice,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error(`Error fetching DNSE price for ${symbol}:`, error);
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
