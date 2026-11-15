import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The type scale and radii from tokens.css, so class merging knows `text-ui` is a size and not a colour.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['nano', 'micro', 'caption', 'label', 'ui', 'body', 'brand'],
      radius: ['kbd', 'nav'],
    },
  },
});

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
