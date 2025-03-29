describe('Technical Indicators Calculations', () => {
    // Test SMA calculation
    test('calculateSMA should return correct values', () => {
        const prices = [1, 2, 3, 4, 5];
        const period = 3;
        const expectedSMA = [null, null, 2, 3, 4];
        
        expect(calculateSMA(prices, period)).toEqual(expectedSMA);
    });

    // Test RSI calculation
    test('calculateRSI should return values between 0 and 100', () => {
        const prices = [10, 12, 11, 13, 15, 14, 16];
        const period = 4;
        const rsi = calculateRSI(prices, period);
        
        // First period-1 values should be null
        expect(rsi.slice(0, period)).toEqual(Array(period).fill(null));
        
        // Remaining values should be between 0 and 100
        rsi.slice(period).forEach(value => {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(100);
        });
    });

    // Test MACD calculation
    test('calculateMACD should return correct structure', () => {
        const prices = Array.from({ length: 50 }, (_, i) => i + 1);
        const macd = calculateMACD(prices);
        
        expect(macd).toHaveProperty('macdLine');
        expect(macd).toHaveProperty('signalLine');
        expect(macd).toHaveProperty('histogram');
        expect(macd.macdLine.length).toBe(prices.length);
        expect(macd.signalLine.length).toBe(prices.length);
        expect(macd.histogram.length).toBe(prices.length);
    });
}); 