import { FormControl, FormGroup, Validators } from '@angular/forms';
import { PrescriptionItemResponse } from '../../models/prescription-api.model';

export function createPrescriptionItemForm(item?: PrescriptionItemResponse) {
  return new FormGroup({
    medicine_id: new FormControl<string | null>(item?.medicine_id ?? null),

    medicine_name_snapshot: new FormControl(item?.medicine_name_snapshot ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),

    dose_text: new FormControl(item?.dose_text ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),

    route: new FormControl(item?.route ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),

    frequency: new FormControl(item?.frequency ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),

    duration_days: new FormControl<number | null>(item?.duration_days ?? null, {
      validators: [Validators.min(1), Validators.pattern(/^[1-9]\d*$/)],
    }),

    instructions: new FormControl(item?.instructions ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),

    quantity: new FormControl(item?.quantity ?? '', {
      nonNullable: true,
    }),

    quantity_unit: new FormControl(item?.quantity_unit ?? '', {
      nonNullable: true,
    }),

    is_prn: new FormControl(item?.is_prn ?? false, {
      nonNullable: true,
    }),
  });
}
