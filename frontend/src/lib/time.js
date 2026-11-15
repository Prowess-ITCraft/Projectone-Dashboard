/* "5 min ago", "3 h ago", "2 d ago" for a timestamp in milliseconds */
export const ago = (t, now = Date.now()) => {
  const m = Math.max(1, Math.round((now - t) / 6e4));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
