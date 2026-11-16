import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// Pages load as separate files (lazy routes), so the first find on a screen can take longer than the 1 s default on a busy machine or CI
configure({ asyncUtilTimeout: 3000 });

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
