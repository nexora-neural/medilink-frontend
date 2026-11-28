import { Injectable, signal } from '@angular/core';
import { createSamplePrescriptions, SAMPLE_DOCTOR_ID } from '../data/prescription-draft.samples';
import {
  canEditPrescriptionDraft,
  PrescriptionDraft,
  PrescriptionHistoryEntry,
  PrescriptionItem,
  DoctorFavorite,
  PrescriptionTemplate,
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

@Injectable({ providedIn: 'root' })
export class PrescriptionDraftPreviewStore {
  private readonly prescriptions = signal<PrescriptionDraft[]>(createSamplePrescriptions());
  private readonly favorites = signal<DoctorFavorite[]>([]);
  private readonly templates = signal<PrescriptionTemplate[]>([]);

  list(): PrescriptionDraft[] {
    return structuredClone(this.prescriptions());
  }

  find(id: string): PrescriptionDraft | null {
    const prescription = this.prescriptions().find((item) => item.id === id);

    return prescription ? structuredClone(prescription) : null;
  }

  listFavorites(doctorId: string): DoctorFavorite[] {
    return structuredClone(
      this.favorites().filter((favorite) => favorite.ownerDoctorId === doctorId),
    );
  }

  addFavorite(doctorId: string, item: PrescriptionItem): DoctorFavorite {
    if (!doctorId.trim()) throw new Error('A doctor account is required to save a favourite.');

    const normalized = cleanInput({ startsOn: '2026-01-01', endsOn: '2026-01-01', items: [item] })
      .items[0];
    const problems = draftProblems({
      startsOn: '2026-01-01',
      endsOn: '2026-01-01',
      items: [normalized],
    });
    if (problems.length) throw new Error(problems.join(' '));

    const duplicate = this.favorites().some(
      (favorite) =>
        favorite.ownerDoctorId === doctorId &&
        favorite.item.medicineName.toLocaleLowerCase() ===
          normalized.medicineName.toLocaleLowerCase() &&
        favorite.item.dose.toLocaleLowerCase() === normalized.dose.toLocaleLowerCase() &&
        favorite.item.route.toLocaleLowerCase() === normalized.route.toLocaleLowerCase() &&
        favorite.item.frequency.toLocaleLowerCase() === normalized.frequency.toLocaleLowerCase(),
    );
    if (duplicate) throw new Error('This medicine is already in your favourites.');

    const favorite: DoctorFavorite = {
      id: `favorite-${crypto.randomUUID()}`,
      ownerDoctorId: doctorId,
      item: { ...normalized, id: `favorite-item-${crypto.randomUUID()}` },
      createdAt: new Date().toISOString(),
    };
    this.favorites.update((items) => [...items, favorite]);
    return structuredClone(favorite);
  }

  removeFavorite(doctorId: string, id: string): void {
    this.favorites.update((items) =>
      items.filter((favorite) => favorite.id !== id || favorite.ownerDoctorId !== doctorId),
    );
  }

  listTemplates(doctorId: string): PrescriptionTemplate[] {
    return structuredClone(
      this.templates().filter((template) => template.ownerDoctorId === doctorId),
    );
  }

  saveTemplate(
    doctorId: string,
    name: string,
    items: PrescriptionItem[],
    id?: string,
  ): PrescriptionTemplate {
    if (!doctorId.trim()) throw new Error('A doctor account is required to save a template.');
    const cleanName = name.trim();
    if (!cleanName || cleanName.length > 80) {
      throw new Error('Enter a template name between 1 and 80 characters.');
    }

    const cleanItems = cleanInput({ startsOn: '2026-01-01', endsOn: '2026-01-01', items }).items;
    const problems = draftProblems({
      startsOn: '2026-01-01',
      endsOn: '2026-01-01',
      items: cleanItems,
    });
    if (problems.length) throw new Error(problems.join(' '));

    const existing = id ? this.templates().find((template) => template.id === id) : undefined;
    if (id && (!existing || existing.ownerDoctorId !== doctorId)) {
      throw new Error('Only the owner doctor can edit this template.');
    }

    const timestamp = new Date().toISOString();
    const template: PrescriptionTemplate = {
      id: existing?.id ?? `template-${crypto.randomUUID()}`,
      ownerDoctorId: doctorId,
      name: cleanName,
      items: cleanItems,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    this.templates.update((all) =>
      existing
        ? all.map((item) => (item.id === existing.id ? template : item))
        : [...all, template],
    );
    return structuredClone(template);
  }

  removeTemplate(doctorId: string, id: string): void {
    this.templates.update((items) =>
      items.filter((template) => template.id !== id || template.ownerDoctorId !== doctorId),
    );
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

  finish(
    id: string,
    action: 'complete' | 'cancel' | 'discontinue',
    reason: string,
  ): PrescriptionDraft {
    const existing = this.prescriptions().find((item) => item.id === id);

    if (!existing || existing.source !== 'doctor' || existing.ownerDoctorId !== SAMPLE_DOCTOR_ID) {
      throw new Error('Only the owner doctor can change this sample prescription.');
    }

    if (existing.status !== 'active') {
      throw new Error('This action is available only for an active prescription.');
    }

    const trimmedReason = reason.trim();

    if (!trimmedReason || trimmedReason.length > 1000) {
      throw new Error('Enter a reason between 1 and 1000 characters.');
    }

    const statuses = {
      complete: 'completed',
      cancel: 'cancelled',
      discontinue: 'discontinued',
    } as const;

    const timestamp = new Date().toISOString();

    const entry: PrescriptionHistoryEntry = {
      id: crypto.randomUUID(),
      action,
      reason: trimmedReason,
      performedAt: timestamp,
      performedBy: SAMPLE_DOCTOR_ID,
    };

    const updated: PrescriptionDraft = {
      ...existing,
      status: statuses[action],
      version: existing.version ?? 1,
      updatedAt: timestamp,
      history: [...(existing.history ?? []), entry],
    };

    this.prescriptions.update((items) => items.map((item) => (item.id === id ? updated : item)));

    return structuredClone(updated);
  }

  createLinkedDraft(
    id: string,
    action: 'correct' | 'renew' | 'reissue',
    reason: string,
  ): PrescriptionDraft {
    const existing = this.prescriptions().find((item) => item.id === id);

    if (!existing || existing.source !== 'doctor' || existing.ownerDoctorId !== SAMPLE_DOCTOR_ID) {
      throw new Error('Only the owner doctor can create a linked sample draft.');
    }

    const allowed =
      existing.status === 'active' || (existing.status === 'completed' && action !== 'correct');

    if (!allowed) {
      throw new Error('This action is unavailable for the current status.');
    }

    const trimmedReason = reason.trim();

    if (!trimmedReason || trimmedReason.length > 1000) {
      throw new Error('Enter a reason between 1 and 1000 characters.');
    }

    const pendingDraft = this.prescriptions().find(
      (item) => item.previousPrescriptionId === id && item.status === 'draft',
    );

    if (pendingDraft) {
      throw new Error('A linked draft already exists. Open it from History.');
    }

    const newId = `sample-linked-${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();

    const historyEntry: PrescriptionHistoryEntry = {
      id: crypto.randomUUID(),
      action,
      reason: trimmedReason,
      performedAt: timestamp,
      performedBy: SAMPLE_DOCTOR_ID,
      relatedPrescriptionId: newId,
    };

    const draft: PrescriptionDraft = {
      ...structuredClone(existing),
      id: newId,
      status: 'draft',
      version: (existing.version ?? 1) + 1,
      previousPrescriptionId: existing.id,
      createdAt: timestamp,
      updatedAt: timestamp,
      history: [
        {
          ...historyEntry,
          id: crypto.randomUUID(),
          relatedPrescriptionId: existing.id,
        },
      ],
    };

    const original: PrescriptionDraft = {
      ...existing,
      history: [...(existing.history ?? []), historyEntry],
    };

    this.prescriptions.update((items) => [
      ...items.map((item) => (item.id === id ? original : item)),
      draft,
    ]);

    return structuredClone(draft);
  }

  issuePreviewDraft(id: string): PrescriptionDraft {
    const existing = this.prescriptions().find((item) => item.id === id);
    if (!existing || !canEditPrescriptionDraft(existing, SAMPLE_DOCTOR_ID)) {
      throw new Error('Only the owner doctor can issue an editable sample draft.');
    }

    const problems = draftProblems({
      startsOn: existing.startsOn,
      endsOn: existing.endsOn,
      items: existing.items,
    });
    if (problems.length) throw new Error(problems.join(' '));

    const updated: PrescriptionDraft = {
      ...existing,
      status: 'active',
      updatedAt: new Date().toISOString(),
    };
    this.prescriptions.update((items) => items.map((item) => (item.id === id ? updated : item)));
    return structuredClone(updated);
  }

  reset(): void {
    this.prescriptions.set(createSamplePrescriptions());
    this.favorites.set([]);
    this.templates.set([]);
  }
}
