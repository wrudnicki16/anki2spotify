import { formatMs } from './formatMs';

describe('formatMs', () => {
  it('formats zero', () => {
    expect(formatMs(0)).toBe('0:00');
  });

  it('formats sub-minute values', () => {
    expect(formatMs(5000)).toBe('0:05');
    expect(formatMs(30000)).toBe('0:30');
    expect(formatMs(59000)).toBe('0:59');
  });

  it('formats exact minutes', () => {
    expect(formatMs(60000)).toBe('1:00');
    expect(formatMs(120000)).toBe('2:00');
  });

  it('formats minutes and seconds', () => {
    expect(formatMs(90000)).toBe('1:30');
    expect(formatMs(185000)).toBe('3:05');
  });

  it('pads single-digit seconds with zero', () => {
    expect(formatMs(61000)).toBe('1:01');
    expect(formatMs(69000)).toBe('1:09');
  });

  it('handles large values', () => {
    expect(formatMs(600000)).toBe('10:00');
    expect(formatMs(3599000)).toBe('59:59');
  });

  it('truncates sub-second precision', () => {
    expect(formatMs(1500)).toBe('0:01');
    expect(formatMs(999)).toBe('0:00');
  });
});
