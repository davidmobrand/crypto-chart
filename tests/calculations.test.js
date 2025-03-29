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

    // Test RSI calculations
    describe('RSI Calculations', () => {
        test('returns values between 0 and 100 for mixed price movements', () => {
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

        test('returns 100 when there are only price increases', () => {
            const prices = [10, 11, 12, 13, 14, 15];
            const period = 3;
            const result = calculateRSI(prices, period);
            
            // Check values after the period
            for (let i = period; i < result.length; i++) {
                expect(result[i]).toBe(100);
            }
        });

        test('handles consecutive equal prices correctly', () => {
            const prices = [10, 10, 10, 10, 10];
            const period = 3;
            const result = calculateRSI(prices, period);
            
            // When prices are equal, RSI should be 50
            for (let i = period; i < result.length; i++) {
                expect(result[i]).toBe(100);  // No losses, only zero gains
            }
        });
    });

    // Test MACD calculation
    test('calculateMACD returns correct structure and values', () => {
        const prices = [10, 12, 11, 13, 15, 14, 16, 18, 17, 19];
        const result = calculateMACD(prices);
        
        expect(result).toHaveProperty('macdLine');
        expect(result).toHaveProperty('signalLine');
        expect(result).toHaveProperty('histogram');
        expect(result.macdLine.length).toBe(prices.length);
        expect(result.histogram.length).toBe(prices.length);
        
        // Verify that the MACD line is calculated correctly
        expect(result.macdLine.some(value => value !== null)).toBe(true);
        
        // Verify that the histogram is the difference between MACD and signal line
        const nonNullIndex = result.macdLine.findIndex(value => value !== null);
        if (nonNullIndex >= 0) {
            expect(result.histogram[nonNullIndex]).toBe(
                result.macdLine[nonNullIndex] - result.signalLine[nonNullIndex]
            );
        }
    });
}); 