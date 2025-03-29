// Technical indicator calculations
export function calculateSMA(data, period) {
    const result = new Array(data.length).fill(null);
    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);
        result[i] = slice.reduce((sum, val) => sum + val, 0) / period;
    }
    return result;
}

export function calculateEMA(data, period) {
    const k = 2 / (period + 1);
    const result = new Array(data.length).fill(null);
    let prevEMA = data[0];
    
    result[0] = prevEMA;
    for (let i = 1; i < data.length; i++) {
        const ema = (data[i] * k) + (prevEMA * (1 - k));
        result[i] = ema;
        prevEMA = ema;
    }
    return result;
}

export function calculateMACD(prices) {
    const fastEMA = calculateEMA(prices, 12);
    const slowEMA = calculateEMA(prices, 26);
    const macdLine = new Array(prices.length).fill(null);
    
    for (let i = 0; i < prices.length; i++) {
        if (fastEMA[i] !== null && slowEMA[i] !== null) {
            macdLine[i] = fastEMA[i] - slowEMA[i];
        }
    }
    
    const signalLine = calculateEMA(macdLine.filter(x => x !== null), 9);
    const histogram = macdLine.map((macd, i) => 
        macd !== null && signalLine[i] !== null ? macd - signalLine[i] : null
    );
    
    return {
        macdLine,
        signalLine,
        histogram
    };
}

export function calculateRSI(prices, period = 14) {
    const result = new Array(prices.length).fill(null);
    const gains = new Array(prices.length).fill(0);
    const losses = new Array(prices.length).fill(0);
    
    // Calculate gains and losses
    for (let i = 1; i < prices.length; i++) {
        const difference = prices[i] - prices[i - 1];
        if (difference > 0) {
            gains[i] = difference;
        } else {
            losses[i] = Math.abs(difference);
        }
    }
    
    // Calculate RSI
    for (let i = period; i < prices.length; i++) {
        const avgGain = gains.slice(i - period + 1, i + 1).reduce((sum, val) => sum + val, 0) / period;
        const avgLoss = losses.slice(i - period + 1, i + 1).reduce((sum, val) => sum + val, 0) / period;
        
        if (avgLoss === 0) {
            result[i] = 100;
        } else {
            const RS = avgGain / avgLoss;
            result[i] = 100 - (100 / (1 + RS));
        }
    }
    
    return result;
} 