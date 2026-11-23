import { describe, expect, it } from 'vitest';
import { DispensingStore, localDate } from './dispensing.store';

describe('DispensingStore preview', () => {
  it('formats the local calendar date rather than the UTC date', () => {
    expect(localDate(new Date(2026, 10, 24, 0, 10))).toBe('2026-11-24');
  });
  it('records partial and complete quantities and calculates remaining supply', () => {
    const store = new DispensingStore();
    store.quantities = [10, 60];
    expect(store.save()).toBe('');
    expect(store.remaining(store.items[0])).toBe(20);
    expect(store.remaining(store.items[1])).toBe(0);
    expect(store.events).toHaveLength(2);
    expect(store.quantities).toEqual([0, 0]);
  });
  it('rejects empty, fractional tablet, negative and over-remaining quantities without recording', () => {
    const store = new DispensingStore();
    for (const quantities of [
      [0, 0],
      [1.5, 0],
      [-1, 3],
      [31, 0],
    ]) {
      store.quantities = quantities;
      expect(store.save()).not.toBe('');
      expect(store.events).toHaveLength(0);
    }
  });
  it('requires a reversal reason, retains the original, restores remaining and rejects repeat reversal', () => {
    const store = new DispensingStore();
    store.quantities = [10, 0];
    store.save();
    const id = store.events[0].id;
    expect(store.reverse(id, '  ')).not.toBe('');
    expect(store.remaining(store.items[0])).toBe(20);
    expect(store.reverse(id, 'Incorrect quantity')).toBe('');
    expect(store.remaining(store.items[0])).toBe(30);
    expect(store.events.map((e) => e.status)).toEqual(['Reversal', 'Reversed']);
    expect(store.events[0].reason).toBe('Incorrect quantity');
    expect(store.reverse(id, 'again')).not.toBe('');
  });
  it('revalidates remaining quantities at save', () => {
    const store = new DispensingStore();
    store.quantities = [25, 0];
    store.save();
    store.quantities = [6, 0];
    expect(store.save()).not.toBe('');
    expect(store.remaining(store.items[0])).toBe(5);
  });
  it('records corrected quantities with a reason and rejects over-correction', () => {
    const store = new DispensingStore();
    store.quantities = [10, 0];
    store.save();
    const id = store.events[0].id;
    expect(store.correct(id, 31, 'wrong')).not.toBe('');
    expect(store.correct(id, 15, '')).not.toBe('');
    expect(store.correct(id, 15, 'Adjusted')).toBe('');
    expect(store.remaining(store.items[0])).toBe(15);
    expect(store.events[0].originalQuantity).toBe(10);
    expect(store.events[1].status).toBe('Reversed');
  });
});
