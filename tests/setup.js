import * as matchers from '@testing-library/jest-dom/matchers';
import { expect, jest, beforeEach } from '@jest/globals';

expect.extend(matchers);

// Create mock canvas
const mockCanvas = {
    getContext: jest.fn(),
    addEventListener: jest.fn(),
    width: 800,
    height: 600
};

// Mock window object
global.window = {
    addEventListener: jest.fn()
};

// Mock document object
global.document = {
    getElementById: jest.fn((id) => {
        if (id === 'priceChart') {
            return mockCanvas;
        }
        return {
            getContext: jest.fn(),
            addEventListener: jest.fn(),
            style: {}
        };
    }),
    addEventListener: jest.fn(),
    createElement: jest.fn(() => ({
        getContext: jest.fn(),
        addEventListener: jest.fn(),
        appendChild: jest.fn(),
        style: {}
    })),
    head: {
        appendChild: jest.fn()
    },
    querySelector: jest.fn(() => ({
        classList: {
            add: jest.fn(),
            remove: jest.fn()
        },
        style: {}
    })),
    querySelectorAll: jest.fn(() => [])
};

// Mock localStorage
global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
};

// Mock fetch
global.fetch = jest.fn();

// Set up global variables that would normally be set by the script
global.priceChart = null;
global.autoRefreshInterval = null;
global.showSMA = false;
global.showRSI = false;
global.showMACD = false;
global.selectedSymbol = 'BTCUSDT';
global.symbols = [];
global.symbolData = {};
global.favorites = new Set();
global.currentFilter = 'all';
global.currentExchange = 'binance';

// Clear mocks before each test
beforeEach(() => {
    jest.clearAllMocks();
}); 