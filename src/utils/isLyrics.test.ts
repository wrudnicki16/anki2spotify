import { isLyrics } from './isLyrics';

describe('isLyrics', () => {
  it('returns true for 3+ words', () => {
    expect(isLyrics('one two three')).toBe(true);
    expect(isLyrics('a b c d')).toBe(true);
  });

  it('returns false for fewer than 3 words', () => {
    expect(isLyrics('hello')).toBe(false);
    expect(isLyrics('two words')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isLyrics('')).toBe(false);
  });

  it('returns false for whitespace-only string', () => {
    expect(isLyrics('   ')).toBe(false);
  });

  it('trims leading/trailing whitespace', () => {
    expect(isLyrics('  one two three  ')).toBe(true);
    expect(isLyrics('  one  ')).toBe(false);
  });

  it('handles multiple spaces between words', () => {
    expect(isLyrics('one   two   three')).toBe(true);
  });

  it('handles tabs and mixed whitespace', () => {
    expect(isLyrics("one\ttwo\tthree")).toBe(true);
    expect(isLyrics("one\t two")).toBe(false);
  });

  it('returns true at exactly 3 words boundary', () => {
    expect(isLyrics('a b c')).toBe(true);
    expect(isLyrics('a b')).toBe(false);
  });
});
