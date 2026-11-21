import { Injectable, signal } from '@angular/core';
import { createSamplePrescriptions, SAMPLE_DOCTOR_ID } from '../data/prescription-draft.samples';
import {
  canEditPrescriptionDraft,
  PrescriptionDraft,
  PrescriptionItem,
} from '../models/prescription-draft.model';

export interface PrescriptionDraftInput {
  startsOn: string;
  endsOn: string;
  items: PrescriptionItem[];
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function draftProblems(input: PrescriptionDraftInput): string[] {
  const problems: string[] = [];

  if (!validDate(input.startsOn) || !validDate(input.endsOn) || input.endsOn < input.startsOn) {
    problems.push('Enter valid start and end dates in the correct order.');
  }

  if (input.items.length === 0) {
    problems.push('Add at least one medicine.');
  }

  const ids = new Set<string>();

  input.items.forEach((item, index) => {
    const label = `Medicine ${index + 1}`;

    if (!item.id.trim() || ids.has(item.id)) {
      problems.push(`${label}: item identity must be unique.`);
    }

    ids.add(item.id);

    if (
      !item.medicineName.trim() ||
      item.medicineName.length > 200 ||
      !item.dose.trim() ||
      item.dose.length > 200 ||
      !item.route.trim() ||
      item.route.length > 100 ||
      !item.frequency.trim() ||
      item.frequency.length > 200
    ) {
      problems.push(`${label}: complete medicine, dose, route and frequency.`);
    }

    if (!Number.isInteger(item.durationDays) || item.durationDays < 1) {
      problems.push(`${label}: duration must be a positive whole number.`);
    }

    if (
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      !['tablet', 'capsule', 'mL'].includes(item.quantityUnit)
    ) {
      problems.push(`${label}: enter a positive quantity and select a unit.`);
    }

    if (item.instructions.length > 2000) {
      problems.push(`${label}: instructions cannot exceed 2000 characters.`);
    }
  });

  return problems;
}

function cleanInput(input: PrescriptionDraftInput): PrescriptionDraftInput {
  return {
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    items: input.items.map((item) => ({
      id: item.id,
      medicineName: item.medicineName.trim(),
      dose: item.dose.trim(),
      route: item.route.trim(),
      frequency: item.frequency.trim(),
      durationDays: item.durationDays,
      quantity: item.quantity,
      quantityUnit: item.quantityUnit,
      instructions: item.instructions.trim(),
      isPrn: item.isPrn,
    })),
  };
}

@Injectable()
export class PrescriptionDraftPreviewStore {
  private readonly prescriptions = signal<PrescriptionDraft[]>(createSamplePrescriptions());

  list(): PrescriptionDraft[] {
    return structuredClone(this.prescriptions());
  }

  find(id: string): PrescriptionDraft | null {
    const prescription = this.prescriptions().find((item) => item.id === id);

    return prescription ? structuredClone(prescription) : null;
  }

  save(id: string, input: PrescriptionDraftInput): PrescriptionDraft {
    const existing = this.prescriptions().find((item) => item.id === id);

    if (!existing || !canEditPrescriptionDraft(existing, SAMPLE_DOCTOR_ID)) {
      throw new Error('Only the owner doctor can edit a doctor-source draft.');
    }

    const problems = draftProblems(input);

    if (problems.length > 0) {
      throw new Error(problems.join(' '));
    }

    const updated: PrescriptionDraft = {
      ...existing,
      ...cleanInput(input),
      updatedAt: new Date().toISOString(),
    };

    this.prescriptions.update((items) => items.map((item) => (item.id === id ? updated : item)));

    return structuredClone(updated);
  }

  reset(): void {
    this.prescriptions.set(createSamplePrescriptions());
  }
}
