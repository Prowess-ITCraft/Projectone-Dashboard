import { describe, expect, it } from 'vitest';
import { toCSV } from './csv';
import { ago } from './time';
import { cn } from './utils';

describe('toCSV', () => {
  it('quotes every cell and doubles quotes inside', () => {
    expect(
      toCSV([
        ['SN', 'Task'],
        [1, 'Say "hello", then leave'],
        [2, null],
      ]),
    ).toBe('"SN","Task"\r\n"1","Say ""hello"", then leave"\r\n"2",""');
  });
});

describe('ago', () => {
  const now = 1_000_000_000_000;
  it('reads in minutes, hours and days', () => {
    expect(ago(now - 10_000, now)).toBe('1 min ago');
    expect(ago(now - 45 * 6e4, now)).toBe('45 min ago');
    expect(ago(now - 3 * 36e5, now)).toBe('3 h ago');
    expect(ago(now - 2 * 864e5, now)).toBe('2 d ago');
  });
});

describe('cn', () => {
  it('keeps a token font size next to a text colour', () => {
    expect(cn('text-ui text-muted-foreground')).toBe('text-ui text-muted-foreground');
  });

  it('lets a later token size replace an earlier one', () => {
    expect(cn('text-ui', 'text-caption')).toBe('text-caption');
    expect(cn('rounded-nav', 'rounded-kbd')).toBe('rounded-kbd');
  });
});
