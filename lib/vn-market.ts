export interface StockPrice {
    symbol: string;
    price: number;
    timestamp: string;
}

export class VNMarketClient {
    private baseUrl = 'https://services.entrade.com.vn/chart-api/v2/stock/quote';

    /**
     * Fetch the real-time quote for a symbol from Entrade API
     */
    async getLatestPrice(symbol: string): Promise<StockPrice | null> {
        try {
            const url = new URL(this.baseUrl);
            url.searchParams.append('symbol', symbol);

            const response = await fetch(url.toString(), {
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                console.error(`Error fetching quote for ${symbol}: ${response.status}`);
                return null;
            }

            const data = await response.json();

            // Structure: { "p": lastPrice, "t": timestamp, ... }
            if (!data || data.p === undefined) {
                console.warn(`No quote data found for ${symbol}`);
                return null;
            }

            const latestPrice = data.p;
            const latestTimestamp = data.t || Math.floor(Date.now() / 1000);

            console.log(`[Realtime] ${symbol} price updated: ${latestPrice}`);

            return {
                symbol,
                price: latestPrice,
                timestamp: new Date(latestTimestamp * 1000).toISOString()
            };

        } catch (error) {
            console.error(`Error fetching real-time price for ${symbol}:`, error);
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
