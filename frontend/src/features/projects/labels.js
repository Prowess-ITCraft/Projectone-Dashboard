/* Plain-language labels for statuses that screens share */
export const DOCUMENT_STATUS = {
  parsed: { label: 'Lines read', tone: 'positive' },
  entered: { label: 'Entered by hand', tone: 'accent' },
  needs_manual: { label: 'Needs details', tone: 'warning' },
  attached: { label: 'Attached', tone: 'neutral' },
};

export const KIND_LABELS = { product: 'Product', service: 'Service', subscription: 'Subscription', unknown: 'Unknown' };
export const KIND_OPTIONS = Object.entries(KIND_LABELS);

export const DELIVERY_OPTIONS = [
  ['awaiting_delivery', 'Awaiting delivery', 'off'],
  ['delivered', 'Delivered'],
];

export const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
};

export const formatTimestamp = (ms) =>
  new Date(ms).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
