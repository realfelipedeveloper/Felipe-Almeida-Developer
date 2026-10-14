import { describe, expect, it } from 'vitest';
import { localDateTimeToIso, toDateTimeLocal } from './date-time-local';

describe('datetime-local e UTC', () => {
  it('exibe um instante UTC no horário local sem cortar o ISO diretamente', () => {
    expect(toDateTimeLocal('2026-10-07T18:05:00.000Z', 180)).toBe('2026-10-07T15:05');
  });

  it('converte o horário local de volta ao mesmo instante UTC', () => {
    expect(localDateTimeToIso('2026-10-07T15:05', 180)).toBe('2026-10-07T18:05:00.000Z');
  });

  it('preserva corretamente offsets à frente de UTC', () => {
    expect(toDateTimeLocal('2026-10-07T12:05:00.000Z', -180)).toBe('2026-10-07T15:05');
    expect(localDateTimeToIso('2026-10-07T15:05', -180)).toBe('2026-10-07T12:05:00.000Z');
  });
});
