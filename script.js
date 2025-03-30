import { calculateSMA, calculateEMA, calculateMACD, calculateRSI } from './calculations.js';

// Global variables
let priceChart;
let autoRefreshInterval;
let showSMA = false;
let showRSI = false;
let showMACD = false;
let selectedSymbol = 'TRUMPUSDT';
let symbols = [];
let symbolData = {};
let favorites = new Set(JSON.parse(localStorage.getItem('favorites') || '[]'));
let currentFilter = 'all';
let currentExchange = 'binance';
let currentApiType = 'websocket';
let websocket = null;
let touchStartX = null;
let touchStartY = null;
let pinchStartDistance = null;
let pinchStartRange = null;

// Toggle functions
export function toggleAutoRefresh() {
    const button = document.getElementById('autoRefresh');
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        button.classList.remove('active');
        console.log('Auto refresh disabled');
    } else {
        updateChart();
        const interval = document.getElementById('interval').value;
        const refreshRate = interval.includes('m') ? 30000 : 60000; // 30s for minute intervals, 60s for others
        autoRefreshInterval = setInterval(updateChart, refreshRate);
        button.classList.add('active');
        console.log('Auto refresh enabled with interval:', refreshRate, 'ms');
    }
}

export function toggleSMA() {
    const button = document.getElementById('smaToggle');
    showSMA = !showSMA;
    button.classList.toggle('active');
    priceChart.options.scales.y.display = true;
    updateChart();
}

export function toggleRSI() {
    const button = document.getElementById('rsiToggle');
    showRSI = !showRSI;
    button.classList.toggle('active');
    priceChart.options.scales.rsi.display = showRSI;
    updateChart();
}

export function toggleMACD() {
    const button = document.getElementById('macdToggle');
    showMACD = !showMACD;
    button.classList.toggle('active');
    priceChart.options.scales.macd.display = showMACD;
    updateChart();
}

// Make functions available globally for HTML onclick handlers
window.toggleAutoRefresh = toggleAutoRefresh;
window.toggleSMA = toggleSMA;
window.toggleRSI = toggleRSI;
window.toggleMACD = toggleMACD;

// Also make other functions needed by HTML available globally
window.toggleFavorite = toggleFavorite;
window.showHistoricalRecommendations = showHistoricalRecommendations;
window.deleteHistoricalRecommendation = deleteHistoricalRecommendation;
window.openRecommendations = openRecommendations;
window.closeRecommendations = closeRecommendations;
window.handleExchangeChange = handleExchangeChange;

// CORS proxy for API calls
const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';

// Exchange-specific API endpoints
const EXCHANGES = {
    binance: {
        baseUrl: 'https://api.binance.com/api/v3',
        wsUrl: 'wss://stream.binance.com:9443/ws',
        klines: '/klines',
        ticker24h: '/ticker/24hr',
        exchangeInfo: '/exchangeInfo',
        symbolTransform: (symbol) => symbol,
        reverseTransform: (symbol) => symbol,
        intervals: {
            '1m': '1m',
            '3m': '3m',
            '5m': '5m',
            '15m': '15m',
            '1h': '1h',
            '4h': '4h',
            '1d': '1d'
        }
    },
    kraken: {
        baseUrl: 'https://api.kraken.com/0/public',
        wsUrl: 'wss://ws.kraken.com',
        klines: '/OHLC',
        ticker24h: '/Ticker',
        exchangeInfo: '/AssetPairs',
        symbolTransform: (symbol) => {
            // Convert Binance style to Kraken style (e.g., BTCUSDT -> XBT/USDT)
            const base = symbol.slice(0, -4);
            const quote = symbol.slice(-4);
            // Special cases for Kraken symbol mapping
            const krakenBase = {
                'BTC': 'XBT',
                'TRUMP': 'TRUMP',  // Keep TRUMP as is
                'DOGE': 'XDG'
            }[base] || base;
            return `${krakenBase}/${quote}`;
        },
        reverseTransform: (symbol) => {
            // Convert Kraken style to Binance style (e.g., XBT/USDT -> BTCUSDT)
            const [base, quote] = symbol.split('/');
            // Special cases for Kraken symbol mapping
            const binanceBase = {
                'XBT': 'BTC',
                'TRUMP': 'TRUMP',  // Keep TRUMP as is
                'XDG': 'DOGE'
            }[base] || base;
            return `${binanceBase}${quote}`;
        },
        intervals: {
            '1m': '1',
            '5m': '5',
            '15m': '15',
            '1h': '60',
            '4h': '240',
            '1d': '1440'
        }
    }
};

// Initialize the chart when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Page loaded, initializing chart...');
    try {
        // Check if running on iOS Safari
        const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                           !window.MSStream && 
                           /WebKit/.test(navigator.userAgent);
        console.log('Environment:', isIOSSafari ? 'iOS Safari' : 'Other browser');
        
        // Initialize components
        initChart();
        initSymbolList();
        updateChart();
        initCanvasEvents();
        
        // Enable auto-refresh by default only for REST API
        if (currentApiType === 'rest') {
            toggleAutoRefresh();
        }
        
        // Setup filter buttons
        document.querySelectorAll('.filter-button').forEach(button => {
            button.addEventListener('click', () => {
                document.querySelectorAll('.filter-button').forEach(b => b.classList.remove('active'));
                button.classList.add('active');
                currentFilter = button.dataset.filter;
                filterSymbols();
            });
        });

        // Add error event listener for Chart.js
        if (priceChart) {
            priceChart.options.onError = function(chart, error) {
                console.error('Chart.js error:', error);
                showError('Chart error: ' + error.message);
            };
        }

        console.log('Initialization complete');
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize application: ' + error.message);
    }
});

// Refresh symbol list
async function refreshSymbolList() {
    const refreshButton = document.querySelector('.refresh-button');
    refreshButton.style.transform = 'rotate(360deg)';
    refreshButton.style.transition = 'transform 1s';
    await initSymbolList();
    setTimeout(() => {
        refreshButton.style.transform = '';
        refreshButton.style.transition = '';
    }, 1000);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize symbol list
async function initSymbolList() {
    try {
        const [exchangeInfo, ticker24h] = await Promise.all([
            fetch('https://api.binance.com/api/v3/exchangeInfo').then(r => r.json()),
            fetch('https://api.binance.com/api/v3/ticker/24hr').then(r => r.json())
        ]);
        
        // Process and store symbol data
        symbolData = {};
        ticker24h.forEach(ticker => {
            if (ticker.symbol.endsWith('USDT')) {
                symbolData[ticker.symbol] = {
                    price: parseFloat(ticker.lastPrice),
                    change: parseFloat(ticker.priceChangePercent),
                    volume: parseFloat(ticker.quoteVolume), // USDT volume
                    high24h: parseFloat(ticker.highPrice),
                    low24h: parseFloat(ticker.lowPrice)
                };
            }
        });
        
        // Filter and sort symbols
        symbols = exchangeInfo.symbols
            .filter(s => s.symbol.endsWith('USDT') && s.status === 'TRADING')
            .map(s => ({
                ...s,
                ...symbolData[s.symbol],
                isFavorite: favorites.has(s.symbol)
            }))
            .sort((a, b) => b.volume - a.volume);
        
        filterSymbols();
        
        // Setup search functionality with debouncing
        const searchInput = document.getElementById('symbolSearch');
        const symbolList = document.getElementById('symbolList');
        
        searchInput.addEventListener('focus', () => {
            symbolList.classList.add('active');
        });
        
        const debouncedFilter = debounce(() => filterSymbols(), 300);
        searchInput.addEventListener('input', debouncedFilter);
        
        // Close list when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.symbol-select-container')) {
                symbolList.classList.remove('active');
            }
        });
        
    } catch (error) {
        console.error('Error fetching symbols:', error);
        showError('Error loading symbol list');
    }
}

// Filter and display symbols based on current criteria
function filterSymbols() {
    const searchTerm = document.getElementById('symbolSearch').value.toUpperCase();
    let filteredSymbols = symbols;
    
    // Apply current filter
    switch (currentFilter) {
        case 'favorites':
            filteredSymbols = filteredSymbols.filter(s => favorites.has(s.symbol));
            break;
        case 'top100':
            filteredSymbols = filteredSymbols.slice(0, 100);
            break;
    }
    
    // Apply search filter
    if (searchTerm) {
        filteredSymbols = filteredSymbols.filter(s => 
            s.symbol.includes(searchTerm) || 
            s.baseAsset.includes(searchTerm)
        );
    }
    
    updateSymbolList(filteredSymbols);
}

// Toggle favorite status for a symbol
function toggleFavorite(symbol) {
    if (favorites.has(symbol)) {
        favorites.delete(symbol);
    } else {
        favorites.add(symbol);
    }
    localStorage.setItem('favorites', JSON.stringify([...favorites]));
    
    // Update symbol data
    const symbolInfo = symbols.find(s => s.symbol === symbol);
    if (symbolInfo) {
        symbolInfo.isFavorite = favorites.has(symbol);
    }
    
    // Refresh display if on favorites filter
    if (currentFilter === 'favorites') {
        filterSymbols();
    } else {
        // Just update the star
        const starElement = document.querySelector(`[data-symbol="${symbol}"] .favorite-star`);
        if (starElement) {
            starElement.classList.toggle('active');
        }
    }
}

// Update symbol list display
function updateSymbolList(symbolsToShow) {
    const symbolList = document.getElementById('symbolList');
    symbolList.innerHTML = '';
    
    symbolsToShow.forEach(symbol => {
        const div = document.createElement('div');
        div.className = `symbol-item${symbol.symbol === selectedSymbol ? ' selected' : ''}`;
        
        const changeClass = symbol.change >= 0 ? 'positive-change' : 'negative-change';
        const changePrefix = symbol.change >= 0 ? '+' : '';
        
        div.innerHTML = `
            <span class="favorite-star${symbol.isFavorite ? ' active' : ''}" data-symbol="${symbol.symbol}">★</span>
            <div class="symbol-info">
                <span class="symbol-name">${symbol.baseAsset}/USDT</span>
                <span class="symbol-volume">Vol: ${formatNumber(symbol.volume)} USDT</span>
            </div>
            <div class="symbol-price-info">
                <div class="symbol-current-price">$${formatPrice(symbol.price)}</div>
                <div class="${changeClass}">${changePrefix}${symbol.change.toFixed(2)}%</div>
            </div>
        `;
        
        // Setup click handlers
        div.querySelector('.favorite-star').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(symbol.symbol);
        });
        
        div.addEventListener('click', () => {
            selectedSymbol = symbol.symbol;
            symbolList.classList.remove('active');
            updateChart();
            
            // Update selected state
            document.querySelectorAll('.symbol-item').forEach(item => {
                item.classList.remove('selected');
            });
            div.classList.add('selected');
        });
        
        symbolList.appendChild(div);
    });
}

// Format large numbers with K, M, B suffixes
function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// Initialize the chart with empty data
function initChart() {
    console.log('Initializing chart...');
    const ctx = document.getElementById('priceChart').getContext('2d');
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Price',
                data: [],
                borderColor: '#1976d2',
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false,
                yAxisID: 'y',
                order: 1
            }, {
                label: 'SMA (20)',
                data: [],
                borderColor: '#ff9800',
                borderWidth: 1,
                pointRadius: 0,
                fill: false,
                yAxisID: 'y',
                order: 2
            }, {
                label: 'RSI (14)',
                data: [],
                borderColor: '#4caf50',
                borderWidth: 1,
                pointRadius: 0,
                fill: false,
                yAxisID: 'rsi',
                order: 3
            }, {
                label: 'MACD Line',
                data: [],
                borderColor: '#2196f3',
                borderWidth: 1,
                pointRadius: 0,
                fill: false,
                yAxisID: 'macd',
                order: 4
            }, {
                label: 'Signal Line',
                data: [],
                borderColor: '#f44336',
                borderWidth: 1,
                pointRadius: 0,
                fill: false,
                yAxisID: 'macd',
                order: 5
            }, {
                label: 'Histogram',
                data: [],
                type: 'bar',
                backgroundColor: context => {
                    const value = context.dataset.data[context.dataIndex]?.y;
                    return value >= 0 ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)';
                },
                borderColor: context => {
                    const value = context.dataset.data[context.dataIndex]?.y;
                    return value >= 0 ? '#4caf50' : '#f44336';
                },
                yAxisID: 'macd',
                order: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        displayFormats: {
                            minute: 'HH:mm',
                            hour: 'HH:mm',
                            day: 'MMM d'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Time'
                    },
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 8
                    }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Price (USDT)'
                    },
                    position: 'left'
                },
                rsi: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'RSI'
                    },
                    position: 'right',
                    display: showRSI,
                    grid: {
                        drawOnChartArea: false,
                        color: context => {
                            const value = context.tick.value;
                            if (value === 70 || value === 30) return '#ff9800';
                            if (value === 50) return '#2196f3';
                            return '#e0e0e0';
                        },
                        lineWidth: context => {
                            const value = context.tick.value;
                            return (value === 70 || value === 30 || value === 50) ? 1 : 0.5;
                        }
                    }
                },
                macd: {
                    display: showMACD,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'MACD'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.dataset.yAxisID === 'rsi') {
                                label += context.parsed.y.toFixed(2);
                            } else if (context.dataset.yAxisID === 'macd') {
                                label += context.parsed.y.toFixed(4);
                            } else {
                                label += '$' + formatPrice(context.parsed.y);
                            }
                            return label;
                        },
                        afterBody: function(tooltipItems) {
                            const dataIndex = tooltipItems[0].dataIndex;
                            const volume = priceChart.data.datasets[0].volume?.[dataIndex];
                            return volume ? `Volume: ${formatNumber(volume)}` : '';
                        }
                    }
                }
            },
            animation: {
                duration: 0
            }
        }
    });
}

// Format price with appropriate decimals
function formatPrice(price) {
    if (price < 0.1) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    if (price < 100) return price.toFixed(2);
    return price.toFixed(1);
}

// Update price display
function updatePriceDisplay(currentPrice, priceChange, percentChange, volume) {
    const priceElement = document.getElementById('current-price');
    const changeElement = document.getElementById('price-change');
    const volumeElement = document.getElementById('volume-info');
    const symbolElement = document.getElementById('current-symbol');
    const favoriteButton = document.getElementById('currentFavorite');
    
    // Update symbol name and favorite state
    symbolElement.textContent = `${selectedSymbol.replace('USDT', '/USDT')}`;
    favoriteButton.classList.toggle('active', favorites.has(selectedSymbol));
    
    // Update price and change
    priceElement.textContent = `$${formatPrice(currentPrice)}`;
    
    const changePrefix = priceChange >= 0 ? '+' : '';
    changeElement.textContent = `${changePrefix}$${formatPrice(priceChange)} (${changePrefix}${percentChange.toFixed(2)}%)`;
    changeElement.className = `price-change ${priceChange >= 0 ? 'positive-change' : 'negative-change'}`;
    
    // Update volume
    volumeElement.textContent = `Volume: ${formatNumber(volume)} USDT`;
}

// Show/hide error message
function showError(message) {
    console.error(message);
}

// Set loading state
function setLoading(isLoading) {
    const container = document.querySelector('.container');
    if (isLoading) {
        container.classList.add('loading');
    } else {
        container.classList.remove('loading');
    }
}

// Enhanced error handling for fetch operations
async function safeFetch(url, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            // Add CORS proxy for Kraken API calls
            const useProxy = url.includes('api.kraken.com');
            const finalUrl = useProxy ? `${CORS_PROXY}${url}` : url;
            
            const response = await fetch(finalUrl, options);
            
            // Handle rate limiting
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After') || 5;
                console.log(`Rate limited. Waiting ${retryAfter} seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                continue;
            }
            
            // Handle other error responses
            if (!response.ok) {
                if (response.status === 400) {
                    throw new Error('Invalid request. Please check your input.');
                } else if (response.status === 403) {
                    throw new Error('Access denied. Please check your API permissions.');
                } else if (response.status === 404) {
                    throw new Error('Resource not found. The trading pair might be delisted.');
                } else if (response.status >= 500) {
                    throw new Error('Server error. Please try again later.');
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            }
            
            const data = await response.json();
            
            // Handle Kraken-specific error responses
            if (currentExchange === 'kraken' && data.error && data.error.length > 0) {
                throw new Error(`Kraken API error: ${data.error[0]}`);
            }
            
            return data;
        } catch (error) {
            console.error(`Attempt ${i + 1} failed for ${url}:`, error);
            
            // On last retry, throw the error
            if (i === retries - 1) {
                if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                    throw new Error('Network error. Please check your internet connection.');
                }
                throw new Error(`Failed to fetch data: ${error.message}`);
            }
            
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
    }
}

// Optimize chart updates by reducing unnecessary redraws
async function updateChart() {
    const interval = document.getElementById('interval').value;
    
    console.log(`Fetching data for ${selectedSymbol} with interval ${interval}...`);
    showError('');
    setLoading(true);
    
    try {
        // If using WebSocket, just subscribe to the new symbol/interval
        if (currentApiType === 'websocket') {
            if (websocket && websocket.readyState === WebSocket.OPEN) {
                subscribeToSymbol();
                setLoading(false);
                return;
            } else {
                initializeWebSocket();
                setLoading(false);
                return;
            }
        }
        
        // REST API data fetching
        const data = await safeFetch(
            `${EXCHANGES[currentExchange].baseUrl}${EXCHANGES[currentExchange].klines}?symbol=${selectedSymbol}&interval=${interval}&limit=100`
        );
        
        if (!data || data.length === 0) {
            throw new Error('No data received from exchange');
        }
        
        console.log('Data received:', data.length, 'candles');
        
        // Process the data
        const prices = data.map(d => parseFloat(d[4]));
        const volumes = data.map(d => parseFloat(d[5]));
        const chartData = data.map(d => ({
            x: new Date(d[0]),
            y: parseFloat(d[4])
        }));
        
        // Batch indicator updates
        const updates = {
            price: {
                data: chartData,
                volume: volumes
            }
        };
        
        // Calculate indicators only if they're visible
        try {
            if (showSMA) {
                updates.sma = {
                    data: data.map((d, i) => ({
                        x: new Date(d[0]),
                        y: calculateSMA(prices, 20)[i]
                    }))
                };
            }
            
            if (showRSI) {
                updates.rsi = {
                    data: data.map((d, i) => ({
                        x: new Date(d[0]),
                        y: calculateRSI(prices, 14)[i]
                    }))
                };
            }

            if (showMACD) {
                const macdData = calculateMACD(prices);
                const timePoints = data.map(d => new Date(d[0]));
                
                updates.macd = {
                    line: timePoints.map((time, i) => ({
                        x: time,
                        y: macdData.macdLine[i]
                    })),
                    signal: timePoints.map((time, i) => ({
                        x: time,
                        y: macdData.signalLine[i]
                    })),
                    histogram: timePoints.map((time, i) => ({
                        x: time,
                        y: macdData.histogram[i]
                    }))
                };
            }
        } catch (error) {
            console.error('Error calculating indicators:', error);
            showError('Error calculating indicators: ' + error.message);
            return;
        }
        
        // Calculate price change
        const currentPrice = parseFloat(data[data.length - 1][4]);
        const previousPrice = parseFloat(data[0][4]);
        const priceChange = currentPrice - previousPrice;
        const percentChange = (priceChange / previousPrice) * 100;
        const currentVolume = volumes.reduce((a, b) => a + b, 0);
        
        // Batch update chart data
        priceChart.data.datasets[0].label = `${selectedSymbol.replace('USDT', '/USDT')} Price`;
        priceChart.data.datasets[0].data = updates.price.data;
        priceChart.data.datasets[0].volume = updates.price.volume;
        
        priceChart.data.datasets[1].data = updates.sma ? updates.sma.data : [];
        priceChart.data.datasets[2].data = updates.rsi ? updates.rsi.data : [];
        
        if (updates.macd) {
            priceChart.data.datasets[3].data = updates.macd.line;
            priceChart.data.datasets[4].data = updates.macd.signal;
            priceChart.data.datasets[5].data = updates.macd.histogram;
        } else {
            priceChart.data.datasets[3].data = [];
            priceChart.data.datasets[4].data = [];
            priceChart.data.datasets[5].data = [];
        }
        
        // Single chart update
        priceChart.update('none');
        
        // Update price display
        updatePriceDisplay(currentPrice, priceChange, percentChange, currentVolume);
        console.log('Chart updated successfully');
    } catch (error) {
        console.error('Error fetching data:', error);
        showError(`Error: ${error.message}`);
        updatePriceDisplay(0, 0, 0, 0);
    } finally {
        setLoading(false);
    }
}

async function handleExchangeChange() {
    const exchange = document.getElementById('exchange').value;
    currentExchange = exchange;
    
    // Update interval options based on exchange
    const intervalSelect = document.getElementById('interval');
    const currentInterval = intervalSelect.value;
    const availableIntervals = Object.keys(EXCHANGES[exchange].intervals);
    
    // Clear and rebuild interval options
    intervalSelect.innerHTML = '';
    availableIntervals.forEach(interval => {
        if (EXCHANGES[exchange].intervals[interval]) {
            const option = document.createElement('option');
            option.value = interval;
            option.textContent = interval.toUpperCase();
            intervalSelect.appendChild(option);
        }
    });
    
    // Set closest available interval
    intervalSelect.value = availableIntervals.includes(currentInterval) ? 
        currentInterval : availableIntervals[0];
    
    // If using WebSocket, reconnect with new exchange
    if (currentApiType === 'websocket') {
        initializeWebSocket();
    }
    
    // Refresh symbol list and chart
    await refreshSymbolList();
    updateChart();
}

async function fetchKrakenSymbols() {
    try {
        const response = await fetch(`${EXCHANGES.kraken.baseUrl}${EXCHANGES.kraken.exchangeInfo}`);
        const data = await response.json();
        
        if (data.error && data.error.length > 0) {
            throw new Error(data.error[0]);
        }
        
        return Object.entries(data.result)
            .filter(([_, info]) => info.quote === 'USDT')
            .map(([symbol, info]) => ({
                symbol: EXCHANGES.kraken.reverseTransform(symbol),
                volume: info.lot_decimals,
                price: 0,
                priceChangePercent: 0
            }));
    } catch (error) {
        console.error('Error fetching Kraken symbols:', error);
        return [];
    }
}

async function fetchBinanceSymbols() {
    try {
        const response = await fetch(`${EXCHANGES.binance.baseUrl}${EXCHANGES.binance.exchangeInfo}`);
        const data = await response.json();
        
        return data.symbols
            .filter(symbol => symbol.quoteAsset === 'USDT')
            .map(symbol => ({
                symbol: symbol.symbol,
                volume: 0,
                price: 0,
                priceChangePercent: 0
            }));
    } catch (error) {
        console.error('Error fetching Binance symbols:', error);
        return [];
    }
}

async function fetch24hData(symbols) {
    const exchange = EXCHANGES[currentExchange];
    
    try {
        if (currentExchange === 'binance') {
            const response = await fetch(`${exchange.baseUrl}${exchange.ticker24h}`);
            const data = await response.json();
            
            return data
                .filter(ticker => ticker.symbol.endsWith('USDT'))
                .map(ticker => ({
                    symbol: ticker.symbol,
                    volume: parseFloat(ticker.volume),
                    price: parseFloat(ticker.lastPrice),
                    priceChangePercent: parseFloat(ticker.priceChangePercent)
                }));
        } else {
            // Kraken requires separate calls for each symbol
            const pairs = symbols.map(s => exchange.symbolTransform(s.symbol)).join(',');
            const response = await fetch(`${exchange.baseUrl}${exchange.ticker24h}?pair=${pairs}`);
            const data = await response.json();
            
            if (data.error && data.error.length > 0) {
                throw new Error(data.error[0]);
            }
            
            return Object.entries(data.result).map(([symbol, ticker]) => ({
                symbol: exchange.reverseTransform(symbol),
                volume: parseFloat(ticker.v[1]),
                price: parseFloat(ticker.c[0]),
                priceChangePercent: ((parseFloat(ticker.c[0]) - parseFloat(ticker.o)) / parseFloat(ticker.o)) * 100
            }));
        }
    } catch (error) {
        console.error(`Error fetching ${currentExchange} 24h data:`, error);
        return [];
    }
}

async function fetchCandlestickData(symbol, interval) {
    const exchange = EXCHANGES[currentExchange];
    const transformedSymbol = exchange.symbolTransform(symbol);
    const exchangeInterval = exchange.intervals[interval];
    
    try {
        if (currentExchange === 'binance') {
            const response = await fetch(
                `${exchange.baseUrl}${exchange.klines}?symbol=${symbol}&interval=${exchangeInterval}&limit=100`
            );
            const data = await response.json();
            
            return data.map(candle => ({
                time: candle[0],
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[5])
            }));
        } else {
            const since = Math.floor(Date.now() / 1000) - (100 * getIntervalSeconds(interval));
            const response = await fetch(
                `${exchange.baseUrl}${exchange.klines}?pair=${transformedSymbol}&interval=${exchangeInterval}&since=${since}`
            );
            const data = await response.json();
            
            if (data.error && data.error.length > 0) {
                throw new Error(data.error[0]);
            }
            
            return Object.values(data.result)[0].map(candle => ({
                time: candle[0] * 1000,
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[6])
            }));
        }
    } catch (error) {
        console.error(`Error fetching ${currentExchange} candlestick data:`, error);
        return [];
    }
}

function getIntervalSeconds(interval) {
    const units = {
        'm': 60,
        'h': 3600,
        'd': 86400
    };
    const value = parseInt(interval);
    const unit = interval.slice(-1);
    return value * units[unit];
}

// Analyze coins for recommendations
async function analyzeCoinsForRecommendations() {
    const recommendations = [];
    const interval = '1m';  // Use 1-minute candles for recent momentum
    
    try {
        // Get top 100 coins by volume
        const volumeSortedSymbols = symbols
            .filter(s => s.volume > 0)  // Ensure we have volume data
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 100);
        
        if (volumeSortedSymbols.length === 0) {
            throw new Error('No valid symbols found for analysis');
        }
        
        console.log('Analyzing', volumeSortedSymbols.length, 'symbols');
        
        for (const symbol of volumeSortedSymbols) {
            try {
                const response = await safeFetch(
                    `${EXCHANGES[currentExchange].baseUrl}/klines?symbol=${symbol.symbol}&interval=${interval}&limit=15`
                );
                
                if (!response || response.length < 15) continue;
                
                const prices = response.map(d => parseFloat(d[4]));
                const volumes = response.map(d => parseFloat(d[5]));
                
                const recentPriceChange = (prices[prices.length - 1] - prices[0]) / prices[0] * 100;
                const averageVolume = volumes.reduce((a, b) => a + b) / volumes.length;
                const recentVolume = volumes[volumes.length - 1];
                const volumeIncrease = recentVolume / averageVolume;
                
                // Calculate average price movement per minute
                const priceChanges = prices.slice(1).map((price, i) => Math.abs(price - prices[i]) / prices[i] * 100);
                const averageVolatility = priceChanges.reduce((a, b) => a + b) / priceChanges.length;
                
                // Calculate momentum (rate of change)
                const momentum = recentPriceChange / 15;
                
                const score = recentPriceChange * 0.4 +
                             (volumeIncrease - 1) * 0.4 +
                             averageVolatility * 0.2;
                
                if (score > 0.5 && recentPriceChange > 0 && volumeIncrease > 1.2) {
                    recommendations.push({
                        symbol: symbol.symbol.replace('USDT', '/USDT'),
                        currentPrice: prices[prices.length - 1],
                        targetPrice: prices[prices.length - 1] * 1.01,
                        score: score,
                        timeEstimates: {
                            halfPercent: Math.max(5, Math.min(30, Math.round(7.5 / averageVolatility))),
                            onePercent: Math.max(5, Math.min(30, Math.round(15 / averageVolatility))),
                            twoPercent: Math.max(5, Math.min(45, Math.round(30 / averageVolatility)))
                        }
                    });
                }
            } catch (error) {
                console.error('Error analyzing symbol:', symbol.symbol, error);
                continue;
            }
        }
        
        return recommendations
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
            
    } catch (error) {
        console.error('Error analyzing coins:', error);
        throw error;
    }
}

// Store recommendations in localStorage
function storeRecommendations(recommendations) {
    const timestamp = new Date().toISOString();
    const historicalRecs = JSON.parse(localStorage.getItem('historicalRecommendations') || '{}');
    
    // Store only the last 10 recommendations
    const timestamps = Object.keys(historicalRecs).sort().reverse();
    if (timestamps.length >= 10) {
        delete historicalRecs[timestamps[timestamps.length - 1]];
    }
    
    historicalRecs[timestamp] = recommendations;
    localStorage.setItem('historicalRecommendations', JSON.stringify(historicalRecs));
    updateHistoricalDropdown();
}

// Update the historical recommendations dropdown
function updateHistoricalDropdown() {
    const select = document.getElementById('historicalRecommendations');
    const historicalRecs = JSON.parse(localStorage.getItem('historicalRecommendations') || '{}');
    
    // Clear existing options except the default
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    // Add options for each stored recommendation
    Object.keys(historicalRecs)
        .sort()
        .reverse()
        .forEach(timestamp => {
            const date = new Date(timestamp);
            const option = document.createElement('option');
            option.value = timestamp;
            option.textContent = date.toLocaleString();
            select.appendChild(option);
        });
}

// Show historical recommendations
function showHistoricalRecommendations(timestamp) {
    if (!timestamp) return;
    
    const historicalRecs = JSON.parse(localStorage.getItem('historicalRecommendations') || '{}');
    const recommendations = historicalRecs[timestamp];
    
    if (recommendations) {
        document.getElementById('recommendationsModal').classList.add('active');
        const contentContainer = document.getElementById('recommendationsContent');
        const progressContainer = document.getElementById('recommendationsProgress');
        
        progressContainer.style.display = 'none';
        contentContainer.style.display = 'block';
        
        updateRecommendationsModal(recommendations, new Date(timestamp));
    }
    
    // Reset the select to the default option
    document.getElementById('historicalRecommendations').value = '';
}

// Update recommendations modal content with optional timestamp
function updateRecommendationsModal(recommendations, timestamp = null) {
    const contentContainer = document.getElementById('recommendationsContent');
    
    if (!recommendations || recommendations.length === 0) {
        contentContainer.innerHTML = `<p>No recommendations available at this time.</p>`;
        return;
    }
    
    const timeHeader = timestamp ? 
        `<div class="recommendations-header">
            <div class="recommendations-timestamp">Recommendations from ${timestamp.toLocaleString()}</div>
            <button class="delete-recommendation-button" onclick="deleteHistoricalRecommendation('${timestamp.toISOString()}')">
                Delete
            </button>
         </div>` : 
        '';
    
    const content = `
        ${timeHeader}
        <table class="recommendations-table">
            <thead>
                <tr>
                    <th></th>
                    <th>Coin</th>
                    <th>Current Price</th>
                    <th>Target (0.5%)</th>
                    <th>Target (1%)</th>
                    <th>Target (2%)</th>
                </tr>
            </thead>
            <tbody>
                ${recommendations.map(rec => {
                    const symbol = rec.symbol.replace('/USDT', 'USDT');
                    const isFavorite = favorites.has(symbol);
                    return `
                    <tr>
                        <td>
                            <span class="favorite-star${isFavorite ? ' active' : ''}" data-symbol="${symbol}">★</span>
                        </td>
                        <td>${rec.symbol}</td>
                        <td>${rec.currentPrice.toFixed(8)}</td>
                        <td>${(rec.currentPrice * 1.005).toFixed(8)}<br/><small>(est <b>${rec.timeEstimates.halfPercent}</b> min)</small></td>
                        <td>${(rec.currentPrice * 1.01).toFixed(8)}<br/><small>(est <b>${rec.timeEstimates.onePercent}</b> min)</small></td>
                        <td>${(rec.currentPrice * 1.02).toFixed(8)}<br/><small>(est <b>${rec.timeEstimates.twoPercent}</b> min)</small></td>
                    </tr>
                `}).join('')}
            </tbody>
        </table>
        <div class="selection-criteria">
            <h3>Selection Criteria</h3>
            <ul>
                <li>Price Momentum: Recent upward trend in the last 15 minutes</li>
                <li>Volume: At least 20% above 15-minute average</li>
                <li>Volatility: Sufficient for expected price movement</li>
                <li>Liquidity: Among top 100 pairs by volume</li>
            </ul>
        </div>
        <div class="recommendations-note">
            <p>Note: Recommendations are based on technical analysis only. Always conduct your own research and use proper risk management. Time estimates are calculated based on recent volatility, momentum, and volume patterns for each coin.</p>
        </div>
    `;
    
    contentContainer.innerHTML = content;
    
    // Add click handlers for favorite stars
    contentContainer.querySelectorAll('.favorite-star').forEach(star => {
        star.addEventListener('click', (e) => {
            const symbol = e.target.dataset.symbol;
            toggleFavorite(symbol);
            e.target.classList.toggle('active');
        });
    });
}

// Update the openRecommendations function
async function openRecommendations() {
    const modal = document.getElementById('recommendationsModal');
    const progressContainer = document.getElementById('recommendationsProgress');
    const contentContainer = document.getElementById('recommendationsContent');
    
    modal.classList.add('active');
    progressContainer.style.display = 'block';
    contentContainer.style.display = 'none';
    contentContainer.innerHTML = '';
    
    try {
        const recommendations = await analyzeCoinsForRecommendations();
        
        if (!recommendations || recommendations.length === 0) {
            throw new Error('No recommendations available at this time');
        }
        
        // Store the recommendations
        storeRecommendations(recommendations);
        
        // Hide progress bar, show content
        progressContainer.style.display = 'none';
        contentContainer.style.display = 'block';
        
        // Update content
        updateRecommendationsModal(recommendations);
        
    } catch (error) {
        progressContainer.style.display = 'none';
        contentContainer.style.display = 'block';
        contentContainer.innerHTML = `
            <div class="error">
                <p>${error.message}</p>
                <p>Please try again in a few minutes.</p>
            </div>
        `;
        console.error('Error:', error);
    }
}

function closeRecommendations() {
    document.getElementById('recommendationsModal').classList.remove('active');
    // Reset containers
    document.getElementById('recommendationsProgress').style.display = 'none';
    document.getElementById('recommendationsContent').innerHTML = '';
}

// Add styles for the recommendations table
const style = document.createElement('style');
style.textContent = `
    .recommendations-controls {
        display: flex;
        gap: 10px;
        margin-left: 20px;
    }

    #historicalRecommendations {
        padding: 8px 16px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: white;
        cursor: pointer;
        font-size: 14px;
        min-width: 200px;
    }

    #historicalRecommendations:hover {
        border-color: #1976d2;
    }

    .recommendations-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
        font-size: 14px;
    }
    
    .recommendations-table th,
    .recommendations-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #ddd;
    }
    
    .recommendations-table th {
        background-color: #f8f9fa;
        font-weight: 500;
    }
    
    .recommendations-table tr:hover {
        background-color: #f5f5f5;
    }
    
    .recommendations-table .favorite-star {
        cursor: pointer;
        color: #ffd700;
        opacity: 0.3;
        transition: opacity 0.2s;
        font-size: 20px;
    }
    
    .recommendations-table .favorite-star:hover {
        opacity: 0.6;
    }
    
    .recommendations-table .favorite-star.active {
        opacity: 1;
    }

    /* Add mobile styles for recommendations table */
    @media (max-width: 768px) {
        .recommendations-table {
            font-size: 12px;
        }

        .recommendations-table th,
        .recommendations-table td {
            padding: 8px 4px;
        }

        .recommendations-table .favorite-star {
            font-size: 24px;
            padding: 8px;
        }

        /* Make the table scrollable horizontally on mobile */
        .recommendations-modal {
            max-width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
        }

        /* Optimize small text for mobile */
        .recommendations-table small {
            display: block;
            margin-top: 4px;
            font-size: 10px;
        }

        /* Adjust column widths for mobile */
        .recommendations-table th:first-child,
        .recommendations-table td:first-child {
            width: 40px;
            min-width: 40px;
        }

        .recommendations-table th:nth-child(2),
        .recommendations-table td:nth-child(2) {
            min-width: 80px;
        }

        .recommendations-table th:nth-child(3),
        .recommendations-table td:nth-child(3) {
            min-width: 100px;
        }
    }

    /* Touch-specific styles for recommendations table */
    @media (hover: none) {
        .recommendations-table .favorite-star {
            opacity: 0.5;
        }

        .recommendations-table .favorite-star:hover {
            opacity: 0.5;
        }

        .recommendations-table .favorite-star.active {
            opacity: 1;
        }

        .recommendations-table tr:hover {
            background-color: transparent;
        }

        .recommendations-table tr:active {
            background-color: #f5f5f5;
        }
    }

    .error {
        color: #d32f2f;
        text-align: center;
        padding: 20px;
    }

    .close-button {
        position: absolute;
        top: 10px;
        right: 10px;
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
        padding: 5px 10px;
        border-radius: 4px;
    }

    .close-button:hover {
        background-color: rgba(0, 0, 0, 0.1);
    }

    .recommendations-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        margin-bottom: 20px;
        background-color: #f5f5f5;
        border-radius: 4px;
    }

    .recommendations-timestamp {
        color: #666;
        font-style: italic;
    }

    .delete-recommendation-button {
        padding: 6px 12px;
        background-color: #dc3545;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.3s;
    }

    .delete-recommendation-button:hover {
        background-color: #c82333;
    }
`;
document.head.appendChild(style);

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    await refreshSymbolList();
    // Initialize WebSocket connection by default
    initializeWebSocket();
    updateChart();
    updateHistoricalDropdown();
});

// Add the delete function
function deleteHistoricalRecommendation(timestamp) {
    const historicalRecs = JSON.parse(localStorage.getItem('historicalRecommendations') || '{}');
    
    if (historicalRecs[timestamp]) {
        delete historicalRecs[timestamp];
        localStorage.setItem('historicalRecommendations', JSON.stringify(historicalRecs));
        
        // Update the dropdown
        updateHistoricalDropdown();
        
        // Close the modal
        closeRecommendations();
    }
}

// Move canvas touch event setup into a function
function initCanvasEvents() {
    const canvas = document.getElementById('priceChart');
    if (!canvas) return;

    let lastTouchTime = 0;

    canvas.addEventListener('touchstart', function(e) {
        lastTouchTime = Date.now();
        if (e.targetTouches.length === 1) {
            const touch = e.targetTouches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
        } else if (e.targetTouches.length === 2) {
            const touch1 = e.targetTouches[0];
            const touch2 = e.targetTouches[1];
            pinchStartDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            pinchStartRange = priceChart.scales.x.max - priceChart.scales.x.min;
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', function(e) {
        // Prevent default only if it's been less than 300ms since touch start
        if (Date.now() - lastTouchTime < 300) {
            e.preventDefault();
        }

        if (e.targetTouches.length === 1 && touchStartX !== null && touchStartY !== null) {
            const touch = e.targetTouches[0];
            const deltaX = touchStartX - touch.clientX;
            const deltaY = touchStartY - touch.clientY;
            
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                const chart = priceChart;
                const range = chart.scales.x.max - chart.scales.x.min;
                const shift = (range * deltaX) / canvas.width;
                
                chart.options.scales.x.min = new Date(chart.scales.x.min.getTime() + shift);
                chart.options.scales.x.max = new Date(chart.scales.x.max.getTime() + shift);
                chart.update('none');
            }
            
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
        } else if (e.targetTouches.length === 2 && pinchStartDistance !== null) {
            const touch1 = e.targetTouches[0];
            const touch2 = e.targetTouches[1];
            const pinchDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            const scale = pinchStartDistance / pinchDistance;
            const chart = priceChart;
            const centerTime = (chart.scales.x.max.getTime() + chart.scales.x.min.getTime()) / 2;
            const newRange = pinchStartRange * scale;
            
            chart.options.scales.x.min = new Date(centerTime - newRange / 2);
            chart.options.scales.x.max = new Date(centerTime + newRange / 2);
            chart.update('none');
        }
    }, { passive: false });

    canvas.addEventListener('touchend', function(e) {
        if (e.targetTouches.length === 0) {
            touchStartX = null;
            touchStartY = null;
            pinchStartDistance = null;
            pinchStartRange = null;
        } else if (e.targetTouches.length === 1) {
            const touch = e.targetTouches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            pinchStartDistance = null;
            pinchStartRange = null;
        }
    }, { passive: true });
}

// Handle API type change
async function handleApiTypeChange() {
    const newApiType = document.getElementById('apiType').value;
    
    // If switching from WebSocket to REST
    if (currentApiType === 'websocket' && newApiType === 'rest') {
        closeWebSocket();
    }
    
    // If switching to WebSocket, disable auto-refresh
    if (newApiType === 'websocket' && autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        document.getElementById('autoRefresh').classList.remove('active');
    }
    
    currentApiType = newApiType;
    
    // If switching to WebSocket
    if (currentApiType === 'websocket') {
        initializeWebSocket();
    }
    
    // Update the chart with the new data source
    updateChart();
}

// Initialize WebSocket connection
async function initializeWebSocket() {
    closeWebSocket(); // Close any existing connection
    
    const exchange = EXCHANGES[currentExchange];
    const wsUrl = exchange.wsUrl;
    console.log(`Initializing WebSocket connection to ${wsUrl}`);
    
    try {
        // For Kraken, verify the symbol using the Ticker endpoint
        if (currentExchange === 'kraken') {
            const krakenSymbol = exchange.symbolTransform(selectedSymbol);
            const symbolCheck = await safeFetch(
                `${exchange.baseUrl}${exchange.ticker24h}?pair=${krakenSymbol}`
            );
            
            if (symbolCheck.error && symbolCheck.error.length > 0) {
                throw new Error(`Invalid symbol: ${krakenSymbol}`);
            }
        } else {
            // Binance symbol check
            const symbolCheck = await safeFetch(
                `${exchange.baseUrl}/ticker/24hr?symbol=${selectedSymbol}`
            );
            
            if (!symbolCheck || symbolCheck.code) {
                throw new Error(`Invalid symbol: ${selectedSymbol}`);
            }
        }
        
        // First, fetch historical data
        const interval = document.getElementById('interval').value;
        const data = await safeFetch(
            `${exchange.baseUrl}${exchange.klines}?symbol=${selectedSymbol}&interval=${interval}&limit=100`
        );
        
        if (!data || data.length === 0) {
            throw new Error('No historical data received');
        }
        
        // Process historical data
        const prices = data.map(d => parseFloat(d[4]));
        const volumes = data.map(d => parseFloat(d[5]));
        const chartData = data.map(d => ({
            x: new Date(d[0]),
            y: parseFloat(d[4])
        }));
        
        // Update chart with historical data
        priceChart.data.datasets[0].data = chartData;
        priceChart.data.datasets[0].volume = volumes;
        
        // Calculate and update indicators
        if (showSMA) {
            const smaData = data.map((d, i) => ({
                x: new Date(d[0]),
                y: calculateSMA(prices, 20)[i]
            }));
            priceChart.data.datasets[1].data = smaData;
        }
        
        if (showRSI) {
            const rsiData = data.map((d, i) => ({
                x: new Date(d[0]),
                y: calculateRSI(prices, 14)[i]
            }));
            priceChart.data.datasets[2].data = rsiData;
        }
        
        if (showMACD) {
            const macdData = calculateMACD(prices);
            const timePoints = data.map(d => new Date(d[0]));
            
            priceChart.data.datasets[3].data = timePoints.map((time, i) => ({
                x: time,
                y: macdData.macdLine[i]
            }));
            priceChart.data.datasets[4].data = timePoints.map((time, i) => ({
                x: time,
                y: macdData.signalLine[i]
            }));
            priceChart.data.datasets[5].data = timePoints.map((time, i) => ({
                x: time,
                y: macdData.histogram[i]
            }));
        }
        
        priceChart.update('none');
        
        // Now initialize WebSocket connection with retry mechanism
        let retryCount = 0;
        const maxRetries = 3;
        let pongReceived = true;
        
        const connectWebSocket = () => {
            websocket = new WebSocket(wsUrl);
            
            websocket.onopen = () => {
                console.log('WebSocket connected successfully to:', wsUrl);
                retryCount = 0; // Reset retry count on successful connection
                subscribeToSymbol();
            };
            
            websocket.onclose = (event) => {
                console.log(`WebSocket disconnected with code ${event.code}, reason: ${event.reason}`);
                if (websocket && websocket.pingInterval) {
                    clearInterval(websocket.pingInterval);
                }
                
                if (retryCount < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
                    console.log(`Retrying connection in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
                    retryCount++;
                    setTimeout(connectWebSocket, delay);
                } else {
                    showError('WebSocket connection failed after multiple attempts. Please refresh the page.');
                }
            };
            
            websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                showError('WebSocket connection error. Retrying...');
            };
            
            websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    // Handle exchange-specific ping/pong
                    if (currentExchange === 'kraken') {
                        if (data.event === 'pong') {
                            pongReceived = true;
                            return;
                        }
                    } else {
                        if (data.pong) {
                            pongReceived = true;
                            return;
                        }
                    }
                    
                    // Log subscription responses
                    if (data.result !== undefined) {
                        console.log('Subscription response:', data);
                    }
                    
                    handleWebSocketMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                    showError('Error processing WebSocket data');
                }
            };
            
            // Setup ping interval to keep connection alive
            const pingInterval = setInterval(() => {
                if (websocket && websocket.readyState === WebSocket.OPEN) {
                    try {
                        // Check if we received a pong from the last ping
                        if (!pongReceived) {
                            console.warn('No pong received, reconnecting...');
                            websocket.close();
                            return;
                        }
                        
                        pongReceived = false; // Reset pong flag
                        
                        // Send exchange-specific ping
                        if (currentExchange === 'kraken') {
                            websocket.send(JSON.stringify({ event: 'ping' }));
                        } else {
                            websocket.send(JSON.stringify({ id: Date.now(), method: 'LIST_SUBSCRIPTIONS' }));
                        }
                    } catch (error) {
                        console.error('Error sending ping:', error);
                        websocket.close();
                    }
                }
            }, 30000); // Send ping every 30 seconds
            
            websocket.pingInterval = pingInterval;
        };
        
        // Start the WebSocket connection
        connectWebSocket();
        
    } catch (error) {
        console.error('Error initializing WebSocket:', error);
        showError('Failed to initialize WebSocket connection: ' + error.message);
        
        // Fallback to REST API if WebSocket fails
        if (error.message.includes('Invalid symbol')) {
            console.log('Invalid symbol, switching to REST API...');
            currentApiType = 'rest';
            document.getElementById('apiType').value = 'rest';
            updateChart();
        }
    }
}

// Close WebSocket connection
function closeWebSocket() {
    if (websocket) {
        clearInterval(websocket.pingInterval);
        websocket.close();
        websocket = null;
    }
}

// Subscribe to symbol updates
function subscribeToSymbol() {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
    
    const interval = document.getElementById('interval').value;
    const symbol = selectedSymbol.toLowerCase();
    
    if (currentExchange === 'binance') {
        try {
            console.log('Subscribing to WebSocket streams for:', symbol);
            
            // Unsubscribe from previous streams first
            const unsubPayload = {
                method: 'UNSUBSCRIBE',
                params: [
                    `${symbol}@kline_${interval}`,
                    `${symbol}@miniTicker`
                ],
                id: 1
            };
            console.log('Unsubscribe payload:', unsubPayload);
            websocket.send(JSON.stringify(unsubPayload));

            // Small delay before subscribing to new streams
            setTimeout(() => {
                const subPayload = {
                    method: 'SUBSCRIBE',
                    params: [
                        `${symbol}@kline_${interval}`,
                        `${symbol}@miniTicker`
                    ],
                    id: 2
                };
                console.log('Subscribe payload:', subPayload);
                websocket.send(JSON.stringify(subPayload));
            }, 500);
            
        } catch (error) {
            console.error('Error in WebSocket subscription:', error);
            showError('WebSocket subscription error: ' + error.message);
            
            // Attempt to reconnect
            setTimeout(() => {
                if (currentApiType === 'websocket') {
                    console.log('Attempting to reconnect after subscription error...');
                    initializeWebSocket();
                }
            }, 5000);
        }
    } else {
        // Kraken WebSocket subscription
        try {
            const krakenSymbol = EXCHANGES.kraken.symbolTransform(selectedSymbol);
            console.log('Subscribing to Kraken WebSocket for:', krakenSymbol);
            
            // Unsubscribe from previous subscription
            const unsubPayload = {
                event: 'unsubscribe',
                pair: [krakenSymbol],
                subscription: {
                    name: 'ohlc',
                    interval: EXCHANGES.kraken.intervals[interval]
                }
            };
            console.log('Kraken unsubscribe payload:', unsubPayload);
            websocket.send(JSON.stringify(unsubPayload));
            
            // Small delay before subscribing
            setTimeout(() => {
                const subPayload = {
                    event: 'subscribe',
                    pair: [krakenSymbol],
                    subscription: {
                        name: 'ohlc',
                        interval: EXCHANGES.kraken.intervals[interval]
                    }
                };
                console.log('Kraken subscribe payload:', subPayload);
                websocket.send(JSON.stringify(subPayload));
            }, 500);
            
        } catch (error) {
            console.error('Error in Kraken WebSocket subscription:', error);
            showError('Kraken WebSocket subscription error: ' + error.message);
        }
    }
}

// Handle WebSocket messages
function handleWebSocketMessage(data) {
    if (!data) return;
    
    try {
        if (currentExchange === 'binance') {
            if (data.e === 'kline') {
                const candle = data.k;
                updateChartWithWebSocketData({
                    time: candle.t,
                    open: parseFloat(candle.o),
                    high: parseFloat(candle.h),
                    low: parseFloat(candle.l),
                    close: parseFloat(candle.c),
                    volume: parseFloat(candle.v)
                });
            } else if (data.e === '24hrMiniTicker') {
                updatePriceDisplay(
                    parseFloat(data.c),
                    0,
                    0,
                    parseFloat(data.v)
                );
            }
        } else {
            // Handle Kraken WebSocket messages
            if (Array.isArray(data)) {
                // Check if it's OHLC data
                if (data[2] === 'ohlc-1' || data[2] === 'ohlc-5' || data[2] === 'ohlc-15' || 
                    data[2] === 'ohlc-60' || data[2] === 'ohlc-240' || data[2] === 'ohlc-1440') {
                    const ohlcData = data[1];
                    if (Array.isArray(ohlcData)) {
                        const [time, open, high, low, close, , , volume] = ohlcData;
                        updateChartWithWebSocketData({
                            time: parseInt(time) * 1000, // Convert to milliseconds
                            open: parseFloat(open),
                            high: parseFloat(high),
                            low: parseFloat(low),
                            close: parseFloat(close),
                            volume: parseFloat(volume)
                        });
                    }
                }
            } else if (data.event === 'heartbeat') {
                // Handle Kraken heartbeat
                console.log('Received Kraken heartbeat');
            } else if (data.event === 'systemStatus') {
                console.log('Kraken WebSocket status:', data.status);
            } else if (data.event === 'subscriptionStatus') {
                console.log('Kraken subscription status:', data.status, 'for', data.pair);
                if (data.status === 'error') {
                    console.error('Kraken subscription error:', data.errorMessage);
                    showError('Kraken subscription error: ' + data.errorMessage);
                }
            }
        }
    } catch (error) {
        console.error('Error processing WebSocket message:', error);
        showError('Error processing WebSocket data: ' + error.message);
    }
}

// Update chart with WebSocket data
function updateChartWithWebSocketData(candle) {
    if (!priceChart) return;
    
    const datasets = priceChart.data.datasets;
    const priceData = datasets[0].data;
    
    // Keep only the last 100 data points
    if (priceData.length >= 100) {
        priceData.shift();
    }
    
    // Update or add the new candle
    const lastIndex = priceData.findIndex(d => d.x.getTime() === candle.time);
    if (lastIndex !== -1) {
        priceData[lastIndex] = { x: new Date(candle.time), y: candle.close };
    } else {
        priceData.push({ x: new Date(candle.time), y: candle.close });
    }
    
    // Update volumes (keep last 100)
    const volumes = [...(datasets[0].volume || []).slice(-99), candle.volume];
    datasets[0].volume = volumes;
    
    // Get all close prices for indicator calculations
    const prices = priceData.map(d => d.y);
    
    // Recalculate indicators if they're visible
    if (showSMA) {
        const smaValues = calculateSMA(prices, 20);
        datasets[1].data = priceData.map((d, i) => ({
            x: d.x,
            y: smaValues[i]
        }));
    }
    
    if (showRSI) {
        const rsiValues = calculateRSI(prices, 14);
        datasets[2].data = priceData.map((d, i) => ({
            x: d.x,
            y: rsiValues[i]
        }));
    }
    
    if (showMACD) {
        const macdData = calculateMACD(prices);
        const timePoints = priceData.map(d => d.x);
        
        datasets[3].data = timePoints.map((time, i) => ({
            x: time,
            y: macdData.macdLine[i]
        }));
        datasets[4].data = timePoints.map((time, i) => ({
            x: time,
            y: macdData.signalLine[i]
        }));
        datasets[5].data = timePoints.map((time, i) => ({
            x: time,
            y: macdData.histogram[i]
        }));
    }
    
    // Update the chart
    priceChart.update('none');
}

// Make the new function available globally
window.handleApiTypeChange = handleApiTypeChange;