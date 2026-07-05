const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Minimal DD MMM YYYY-style formatter — the only pattern the settings screen currently offers. */
export function formatDate(value: Date | string | null | undefined, _pattern = 'DD MMM YYYY'): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS[date.getMonth()];
  return `${day} ${month} ${date.getFullYear()}`;
}

export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const amount = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(amount)) return '';
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
