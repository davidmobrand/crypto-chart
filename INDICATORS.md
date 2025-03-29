# Technical Indicators Guide

This guide explains the technical indicators available in the cryptocurrency price chart application and how to interpret them for trading decisions.

## Simple Moving Average (SMA-20)

### What It Is
The Simple Moving Average (SMA) calculates the average price over a specified period (20 periods in our implementation). It helps identify the overall trend direction and potential support/resistance levels.

### How to Read It
- When price is above SMA: Generally bullish trend
- When price is below SMA: Generally bearish trend
- Price crossing SMA: Potential trend reversal
- SMA slope: Indicates trend strength and direction

### Trading Signals
1. **Trend Following**
   - Enter long when price crosses above SMA
   - Exit long when price crosses below SMA
   - The steeper the SMA slope, the stronger the trend

2. **Support/Resistance**
   - SMA often acts as dynamic support in uptrends
   - SMA often acts as dynamic resistance in downtrends
   - Multiple tests of the SMA can indicate strong support/resistance levels

## Relative Strength Index (RSI-14)

### What It Is
The Relative Strength Index (RSI) measures the speed and magnitude of recent price changes to evaluate overbought or oversold conditions. It oscillates between 0 and 100.

### How to Read It
- RSI > 70: Potentially overbought conditions
- RSI < 30: Potentially oversold conditions
- RSI = 50: Neutral level
- Divergences between RSI and price can signal potential reversals

### Trading Signals
1. **Overbought/Oversold**
   - Consider selling when RSI moves above 70
   - Consider buying when RSI moves below 30
   - More extreme readings (>80 or <20) indicate stronger signals

2. **Divergences**
   - Bullish divergence: Price makes lower lows while RSI makes higher lows
   - Bearish divergence: Price makes higher highs while RSI makes lower highs

3. **Trend Confirmation**
   - RSI staying above 50 in uptrends
   - RSI staying below 50 in downtrends
   - Crossing 50 can signal trend changes

## Moving Average Convergence Divergence (MACD)

### What It Is
MACD is a trend-following momentum indicator that shows the relationship between two moving averages of an asset's price. It consists of:
- MACD Line: Difference between 12 and 26-period EMAs
- Signal Line: 9-period EMA of the MACD Line
- Histogram: Difference between MACD and Signal lines

### How to Read It
- MACD above zero: Bullish momentum
- MACD below zero: Bearish momentum
- Histogram shows momentum strength and potential reversals
- Signal line crossovers indicate potential entry/exit points

### Trading Signals
1. **Signal Line Crossovers**
   - Bullish: MACD crosses above signal line
   - Bearish: MACD crosses below signal line
   - Stronger signals when occurring above/below zero line

2. **Zero Line Crossovers**
   - Bullish: MACD crosses above zero
   - Bearish: MACD crosses below zero
   - Major trend change signals

3. **Divergences**
   - Bullish divergence: Price makes lower lows while MACD makes higher lows
   - Bearish divergence: Price makes higher highs while MACD makes lower highs

## Using Indicators Together

### Trend Confirmation
1. Use SMA for primary trend direction
2. Confirm with RSI staying above/below 50
3. Look for MACD zero line crossovers in the same direction

### Entry Points
1. Wait for price to cross SMA in trend direction
2. Check RSI isn't in extreme territory
3. Look for MACD signal line crossover

### Exit Points
1. Price crossing SMA against trend
2. RSI reaching overbought/oversold levels
3. MACD divergence or signal line crossover

### Risk Management
- Don't rely on any single indicator
- Look for confluence between multiple indicators
- Consider broader market conditions
- Use appropriate stop losses
- Monitor trading volume for confirmation

## Important Notes

1. **No Perfect Indicator**
   - All indicators can give false signals
   - Use multiple timeframes for confirmation
   - Consider fundamental analysis alongside technical indicators

2. **Market Conditions**
   - Indicators work best in trending markets
   - Different indicators suit different market conditions
   - Adjust strategies based on market volatility

3. **Best Practices**
   - Start with one or two indicators
   - Add more as you understand each one
   - Practice in different market conditions
   - Keep detailed trading notes
   - Always use proper risk management 