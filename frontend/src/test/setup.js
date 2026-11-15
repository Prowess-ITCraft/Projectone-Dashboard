import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom has no matchMedia. Tests run as a wide screen unless they set window.__narrow before rendering.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    get matches() {
      return /max-width/.test(query) ? Boolean(window.__narrow) : false;
    },
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.__narrow = false;
});
