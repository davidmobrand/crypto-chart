import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock fetch
global.fetch = jest.fn();

// Reset mocks before each test
beforeEach(() => {
    localStorage.getItem.mockClear();
    localStorage.setItem.mockClear();
    fetch.mockClear();
}); 