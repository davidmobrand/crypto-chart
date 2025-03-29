import * as matchers from '@testing-library/jest-dom/matchers';
import { expect, jest, beforeEach } from '@jest/globals';

expect.extend(matchers);

// Mock localStorage
global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
};

// Mock fetch
global.fetch = jest.fn();

// Mock canvas and other DOM elements
const mockCanvas = {
    getContext: jest.fn(),
    addEventListener: jest.fn(),
    width: 800,
    height: 600
};

global.canvas = mockCanvas;
global.document = {
    getElementById: jest.fn((id) => {
        if (id === 'priceChart') {
            return mockCanvas;
        }
        return {
            getContext: jest.fn(),
            addEventListener: jest.fn()
        };
    }),
    addEventListener: jest.fn(),
    createElement: jest.fn(() => ({
        getContext: jest.fn(),
        addEventListener: jest.fn(),
        appendChild: jest.fn()
    })),
    head: {
        appendChild: jest.fn()
    },
    querySelectorAll: jest.fn(() => [])
};

// Clear mocks before each test
beforeEach(() => {
    jest.clearAllMocks();
}); 