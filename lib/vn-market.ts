export interface StockPrice {
    symbol: string;
    price: number;
    timestamp: string;
}

export class VNMarketClient {
    private baseUrl = 'https://services.entrade.com.vn/dnse-market-info-service/prices/quotes';

    /**
     * Fetch the real-time quote from DNSE/Entrade Market Info Service
     */
    async getLatestPrice(symbol: string): Promise<StockPrice | null> {
        try {
            const url = new URL(this.baseUrl);
            url.searchParams.append('symbols', symbol);
            url.searchParams.append('_', Date.now().toString()); // Cache busting

            console.log(`[VNMarket] Fetching ${symbol} from Entrade Real-time...`);

            const response = await fetch(url.toString(), {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept': 'application/json',
                    'Referer': 'https://banggia.dnse.com.vn/',
                    'Origin': 'https://banggia.dnse.com.vn'
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                console.error(`Error fetching ${symbol}: ${response.status}`);
                return null;
            }

            const json = await response.json();

            // Log full response if it seems empty
            if (!json || (Array.isArray(json) && json.length === 0)) {
                console.warn(`Empty response for ${symbol}:`, json);
                return null;
            }

            // Entrade usually returns an array [ { symbol: "BID", lastPrice: 55.4, ... } ]
            const data = Array.isArray(json) ? json[0] : (json.data?.[0] || json[symbol]);

            if (!data) {
                console.warn(`Could not find data for ${symbol} in response`);
                return null;
            }

            // Try different possible field names for price
            const latestPrice = data.lastPrice || data.price || data.p || data.close;

            if (latestPrice === undefined) {
                console.warn(`Price field missing for ${symbol}`, data);
                return null;
            }

            console.log(`[VNMarket] ${symbol} price found: ${latestPrice}`);

            return {
                symbol,
                price: latestPrice,
                timestamp: new Date().toISOString()
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
