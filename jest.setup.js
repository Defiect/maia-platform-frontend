import '@testing-library/jest-dom'
import React from 'react'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}))

// Mock Next.js image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img {...props} />
  },
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {
    // Mock constructor
  }
  disconnect() {
    // Mock disconnect
  }
  observe() {
    // Mock observe
  }
  unobserve() {
    // Mock unobserve
  }
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {
    // Mock constructor
  }
  disconnect() {
    // Mock disconnect
  }
  observe() {
    // Mock observe
  }
  unobserve() {
    // Mock unobserve
  }
}

// Mock Web Workers and heavy dependencies
jest.mock('onnxruntime-web', () => ({
  InferenceSession: {
    create: jest.fn().mockResolvedValue({
      run: jest.fn().mockResolvedValue({}),
    }),
  },
  Tensor: jest.fn(),
}))

// Mock @lichess-org/stockfish-web with conditional require
try {
  jest.mock('@lichess-org/stockfish-web', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      postMessage: jest.fn(),
      onmessage: jest.fn(),
      terminate: jest.fn(),
    })),
  }))
} catch (error) {
  // Module not found, skip mocking
}

// Mock PostHog
jest.mock('posthog-js', () => ({
  init: jest.fn(),
  capture: jest.fn(),
  identify: jest.fn(),
  reset: jest.fn(),
  isFeatureEnabled: jest.fn().mockReturnValue(false),
}))

// Mock audio elements
global.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined)
global.HTMLMediaElement.prototype.pause = jest.fn()
global.HTMLMediaElement.prototype.load = jest.fn()

// Mock Chessground
jest.mock('@react-chess/chessground', () => {
  return function Chessground(props) {
    return React.createElement('div', {
      'data-testid': 'chessground',
      className: 'chessground-mock',
      ...props,
    })
  }
})
