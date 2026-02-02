import {
    isInZone,
    shouldTriggerAlert,
    isCooldownExpired,
    generateAlertReason
} from '../lib/alert-logic';
import { Watchlist, WatchlistState } from '../lib/types';

describe('Alert Logic Tests', () => {
    describe('isInZone', () => {
        test('price within both bounds', () => {
            expect(isInZone(150, 100, 200)).toBe(true);
        });

        test('price below min bound', () => {
            expect(isInZone(50, 100, 200)).toBe(false);
        });

        test('price above max bound', () => {
            expect(isInZone(250, 100, 200)).toBe(false);
        });

        test('price at min bound', () => {
            expect(isInZone(100, 100, 200)).toBe(true);
        });

        test('price at max bound', () => {
            expect(isInZone(200, 100, 200)).toBe(true);
        });

        test('only min bound set - price above', () => {
            expect(isInZone(150, 100, null)).toBe(true);
        });

        test('only min bound set - price below', () => {
            expect(isInZone(50, 100, null)).toBe(false);
        });

        test('only max bound set - price below', () => {
            expect(isInZone(150, null, 200)).toBe(true);
        });

        test('only max bound set - price above', () => {
            expect(isInZone(250, null, 200)).toBe(false);
        });

        test('no bounds set', () => {
            expect(isInZone(150, null, null)).toBe(false);
        });
    });

    describe('shouldTriggerAlert - Edge Trigger Logic', () => {
        const mockWatchlist: Watchlist = {
            id: '1',
            user_id: 'user1',
            symbol: 'AAPL',
            buy_min: 100,
            buy_max: 200,
            enabled: true,
            cooldown_minutes: 60,
            created_at: new Date().toISOString()
        };

        test('trigger when entering zone from outside (no previous state)', () => {
            expect(shouldTriggerAlert(150, mockWatchlist, null)).toBe(true);
        });

        test('do not trigger when outside zone', () => {
            expect(shouldTriggerAlert(50, mockWatchlist, null)).toBe(false);
        });

        test('trigger when transitioning from out-of-zone to in-zone', () => {
            const state: WatchlistState = {
                watchlist_id: '1',
                last_in_zone: false,
                last_price: 50,
                last_ts: new Date().toISOString(),
                last_alert_at: null
            };
            expect(shouldTriggerAlert(150, mockWatchlist, state)).toBe(true);
        });

        test('do not retrigger when already in zone', () => {
            const state: WatchlistState = {
                watchlist_id: '1',
                last_in_zone: true,
                last_price: 150,
                last_ts: new Date().toISOString(),
                last_alert_at: new Date().toISOString()
            };
            expect(shouldTriggerAlert(160, mockWatchlist, state)).toBe(false);
        });

        test('do not trigger when transitioning from in-zone to out-of-zone', () => {
            const state: WatchlistState = {
                watchlist_id: '1',
                last_in_zone: true,
                last_price: 150,
                last_ts: new Date().toISOString(),
                last_alert_at: new Date().toISOString()
            };
            expect(shouldTriggerAlert(50, mockWatchlist, state)).toBe(false);
        });
    });

    describe('isCooldownExpired', () => {
        test('no previous alert - cooldown expired', () => {
            expect(isCooldownExpired(null, 60)).toBe(true);
        });

        test('alert within cooldown period', () => {
            const recentAlert = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago
            expect(isCooldownExpired(recentAlert, 60)).toBe(false);
        });

        test('alert outside cooldown period', () => {
            const oldAlert = new Date(Date.now() - 90 * 60 * 1000).toISOString(); // 90 min ago
            expect(isCooldownExpired(oldAlert, 60)).toBe(true);
        });

        test('alert exactly at cooldown boundary', () => {
            const boundaryAlert = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 60 min ago
            expect(isCooldownExpired(boundaryAlert, 60)).toBe(true);
        });
    });

    describe('generateAlertReason', () => {
        test('both bounds set', () => {
            const reason = generateAlertReason('AAPL', 150, 100, 200);
            expect(reason).toContain('AAPL');
            expect(reason).toContain('$150.00');
            expect(reason).toContain('$100.00');
            expect(reason).toContain('$200.00');
            expect(reason).toContain('buy zone');
        });

        test('only min bound set', () => {
            const reason = generateAlertReason('AAPL', 150, 100, null);
            expect(reason).toContain('AAPL');
            expect(reason).toContain('$150.00');
            expect(reason).toContain('$100.00');
            expect(reason).toContain('above buy minimum');
        });

        test('only max bound set', () => {
            const reason = generateAlertReason('AAPL', 150, null, 200);
            expect(reason).toContain('AAPL');
            expect(reason).toContain('$150.00');
            expect(reason).toContain('$200.00');
            expect(reason).toContain('below buy maximum');
        });

        test('no bounds set', () => {
            const reason = generateAlertReason('AAPL', 150, null, null);
            expect(reason).toContain('AAPL');
            expect(reason).toContain('$150.00');
            expect(reason).toContain('price update');
        });
    });
});
