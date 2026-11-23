import { Injectable } from '@angular/core';

export interface Medicine {
  name: string;
  dose: string;
  instructions: string;
  prescribed: number;
  unit: string;
  step: number;
}
export interface DispensingEvent {
  id: number;
  item: string;
  quantity: number;
  unit: string;
  date: string;
  notes: string;
  status: 'Recorded' | 'Reversed' | 'Reversal';
  originalQuantity?: number;
  reason?: string;
  originalId?: number;
}

export function localDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Injectable({ providedIn: 'root' })
export class DispensingStore {
  readonly items: Medicine[] = [
    {
      name: 'Amlodipine',
      dose: '5 mg',
      instructions: 'Once daily',
      prescribed: 30,
      unit: 'tablets',
      step: 1,
    },
    {
      name: 'Metformin',
      dose: '500 mg',
      instructions: 'Twice daily',
      prescribed: 60,
      unit: 'tablets',
      step: 1,
    },
  ];
  async load(): Promise<readonly Medicine[]> {
    return this.items;
  }
  events: DispensingEvent[] = [];
  quantities: number[] = this.items.map(() => 0);
  date = localDate();
  notes = '';
  private sequence = 0;
  remaining(item: Medicine): number {
    return (
      item.prescribed -
      this.events
        .filter((e) => e.item === item.name && e.status === 'Recorded')
        .reduce((sum, e) => sum + e.quantity, 0)
    );
  }
  validate(): string {
    if (!this.date) return 'Enter a dispensing date.';
    if (!this.quantities.some((q) => Number(q) > 0))
      return 'Enter a positive quantity for at least one medicine.';
    if (
      this.quantities.some(
        (q, i) =>
          !Number.isFinite(Number(q)) ||
          Number(q) < 0 ||
          Number(q) > this.remaining(this.items[i]) ||
          (this.items[i].step === 1 && !Number.isInteger(Number(q))),
      )
    )
      return 'Enter valid quantities within the remaining amounts.';
    return '';
  }
  save(): string {
    const error = this.validate();
    if (error) return error;
    this.items.forEach((item, i) => {
      const quantity = Number(this.quantities[i]);
      if (quantity > 0)
        this.events.unshift({
          id: ++this.sequence,
          item: item.name,
          quantity,
          unit: item.unit,
          date: this.date,
          notes: this.notes.trim(),
          status: 'Recorded',
        });
    });
    this.quantities = this.items.map(() => 0);
    this.notes = '';
    return '';
  }
  validateCorrection(id: number, quantity: number, reason: string): string {
    const event = this.events.find((e) => e.id === id && e.status === 'Recorded');
    if (!event) return 'This entry is no longer available for correction.';
    if (!reason.trim()) return 'Enter a reason for the correction.';
    const item = this.items.find((i) => i.name === event.item);
    if (
      !item ||
      quantity == null ||
      !Number.isFinite(Number(quantity)) ||
      Number(quantity) < 0 ||
      (item.step === 1 && !Number.isInteger(Number(quantity))) ||
      Number(quantity) > this.remaining(item) + event.quantity
    )
      return 'Enter a valid corrected quantity within the available amount.';
    return '';
  }
  correct(id: number, quantity: number, reason: string): string {
    const error = this.validateCorrection(id, quantity, reason);
    if (error) return error;
    const event = this.events.find((e) => e.id === id && e.status === 'Recorded')!;
    if (Number(quantity) === 0) return this.reverse(id, reason);
    event.status = 'Reversed';
    this.events.unshift({
      id: ++this.sequence,
      item: event.item,
      quantity: Number(quantity),
      unit: event.unit,
      date: localDate(),
      notes: event.notes,
      status: 'Recorded',
      reason: reason.trim(),
      originalId: event.id,
      originalQuantity: event.quantity,
    });
    return '';
  }
  reverse(id: number, reason: string): string {
    const event = this.events.find((e) => e.id === id && e.status === 'Recorded');
    if (!event) return 'This entry is no longer available for reversal.';
    if (!reason.trim()) return 'Enter a reason for the reversal.';
    event.status = 'Reversed';
    this.events.unshift({
      id: ++this.sequence,
      item: event.item,
      quantity: event.quantity,
      unit: event.unit,
      date: localDate(),
      notes: '',
      status: 'Reversal',
      reason: reason.trim(),
      originalId: event.id,
    });
    return '';
  }
}
