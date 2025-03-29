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

// Clear mocks before each test
beforeEach(() => {
    jest.clearAllMocks();
}); 