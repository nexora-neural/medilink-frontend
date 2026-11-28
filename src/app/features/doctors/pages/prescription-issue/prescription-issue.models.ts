export interface PrescriptionItem {
  id: string;
  medicineName: string;
  dose: string;
  route: string;
  frequency: string;
  durationDays: number;
  quantity: number;
  quantityUnit: string;
  instructions: string;
  isPrn: boolean;
}

export interface IssueReview {
  id: string;
  patientName: string;
  patientReference: string;
  consultationId: string;
  verifiedDoctor: boolean;
  ownerDoctor: boolean;
  consultationPermitted: boolean;
  prescriptionGrant: boolean;
  source: 'doctor' | 'patient';
  status: 'draft' | 'active' | 'superseded' | 'completed' | 'cancelled' | 'discontinued';
  startsOn: string;
  endsOn: string;
  warnings: string[];
  items: PrescriptionItem[];
}

/** UI checks are guidance; the issue API must revalidate all authority and data. */
export function issueProblems(review: IssueReview): string[] {
  const errors: string[] = [];
  if (review.status !== 'draft') errors.push('Only a draft prescription can be issued.');
  if (!review.verifiedDoctor) errors.push('Doctor verification is required.');
  if (!review.ownerDoctor || review.source !== 'doctor')
    errors.push('Only the owner doctor can issue a doctor-source draft.');
  if (!review.consultationId || !review.consultationPermitted || !review.prescriptionGrant)
    errors.push('Current consultation permission and prescription access are required.');
  const dateValid = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (!dateValid(review.startsOn) || !dateValid(review.endsOn) || review.endsOn < review.startsOn)
    errors.push('Valid prescription start and end dates are required.');
  if (!review.items.length) errors.push('At least one complete prescription item is required.');
  const ids = new Set<string>();
  review.items.forEach((item, index) => {
    if (!item.id || ids.has(item.id))
      errors.push(`Item ${index + 1}: unique item identity required.`);
    ids.add(item.id);
    if (
      !item.medicineName.trim() ||
      item.medicineName.length > 200 ||
      !item.dose.trim() ||
      item.dose.length > 200 ||
      !item.route.trim() ||
      item.route.length > 100 ||
      !item.frequency.trim() ||
      item.frequency.length > 200 ||
      !Number.isInteger(item.durationDays) ||
      item.durationDays < 1 ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      !['tablet', 'capsule', 'mL'].includes(item.quantityUnit) ||
      item.instructions.length > 2000
    )
      errors.push(
        `Item ${index + 1}: complete medicine, dose, route, frequency, duration and quantity/unit are required.`,
      );
  });
  return errors;
}
