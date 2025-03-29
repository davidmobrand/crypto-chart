import * as matchers from '@testing-library/jest-dom/matchers';
import { expect, jest, beforeEach } from '@jest/globals';

expect.extend(matchers);

// Mock localStorage
const localStorageMock = {
    getItem: () => null,
    setItem: () => null,
    removeItem: () => null,
    clear: () => null
};

global.localStorage = localStorageMock;

// Create spies for localStorage methods
const getItemSpy = jest.spyOn(localStorage, 'getItem');
const setItemSpy = jest.spyOn(localStorage, 'setItem');
const removeItemSpy = jest.spyOn(localStorage, 'removeItem');
const clearSpy = jest.spyOn(localStorage, 'clear');

// Mock fetch
global.fetch = jest.fn();

// Clear mocks before each test
beforeEach(() => {
    getItemSpy.mockClear();
    setItemSpy.mockClear();
    removeItemSpy.mockClear();
    clearSpy.mockClear();
    fetch.mockClear();
}); 