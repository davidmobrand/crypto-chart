import { describe, test, expect } from '@jest/globals';
import { calculateSMA, calculateRSI, calculateMACD } from '../calculations.js';

describe('Technical Indicators Calculations', () => {
    // Test SMA calculation
    test('calculateSMA returns correct values', () => {
        const prices = [1, 2, 3, 4, 5];
        const period = 3;
        const result = calculateSMA(prices, period);
        expect(result[2]).toBe(2); // (1 + 2 + 3) / 3
        expect(result[3]).toBe(3); // (2 + 3 + 4) / 3
        expect(result[4]).toBe(4); // (3 + 4 + 5) / 3
    });

    // Test RSI calculation
    test('calculateRSI returns values between 0 and 100', () => {
        const prices = [10, 12, 11, 13, 15, 14, 16, 18, 17, 19];
        const period = 5;
        const result = calculateRSI(prices, period);
        
        // First period-1 values should be null
        for (let i = 0; i < period - 1; i++) {
            expect(result[i]).toBeNull();
        }
        
        // All other values should be between 0 and 100
        for (let i = period; i < result.length; i++) {
            expect(result[i]).toBeGreaterThanOrEqual(0);
            expect(result[i]).toBeLessThanOrEqual(100);
        }
    });

    // Test MACD calculation
    test('calculateMACD returns correct structure', () => {
        const prices = [10, 12, 11, 13, 15, 14, 16, 18, 17, 19];
        const result = calculateMACD(prices);
        
        expect(result).toHaveProperty('macdLine');
        expect(result).toHaveProperty('signalLine');
        expect(result).toHaveProperty('histogram');
        expect(result.macdLine.length).toBe(prices.length);
        expect(result.histogram.length).toBe(prices.length);
    });
}); 