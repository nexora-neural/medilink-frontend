export type PrescriptionQuantityUnit = 'tablet' | 'capsule' | 'mL';

export interface PrescriptionItemInput {
  medicine_id: string | null;
  medicine_name_snapshot: string;
  dose_text: string;
  route: string | null;
  frequency: string;
  duration_days: number | null;
  instructions: string | null;
  quantity: string | null;
  quantity_unit: PrescriptionQuantityUnit | null;
  is_prn: boolean;
}

export interface PrescriptionInput {
  consultation_id: string | null;
  claimed_prescriber: string | null;
  starts_on: string | null;
  ends_on: string | null;
  original_document_id: string | null;
  items: PrescriptionItemInput[];
}

export interface PrescriptionRecordResponse {
  id: string;
  patient_user_id: string;
  consultation_id: string | null;
  prescriber_user_id: string | null;
  source: string;
  claimed_prescriber: string | null;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  status: string;
  issued_at: string | null;
  starts_on: string | null;
  ends_on: string | null;
  previous_prescription_id: string | null;
  original_document_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  version: number;
  status_reason: string | null;
}

export interface PrescriptionItemResponse {
  id: string;
  prescription_id: string;
  medicine_id: string | null;
  medicine_name_snapshot: string;
  dose_text: string;
  route: string | null;
  frequency: string;
  duration_days: number | null;
  instructions: string | null;
  quantity: string | null;
  quantity_unit: string | null;
  is_prn: boolean;
  created_at: string;
}

export interface PrescriptionReviewResponse {
  id: string;
  prescription_id: string;
  reviewer_user_id: string;
  outcome: string;
  notes: string | null;
  reviewed_at: string;
}

export interface PrescriptionDetailResponse {
  prescription: PrescriptionRecordResponse;
  items: PrescriptionItemResponse[];
  reviews: PrescriptionReviewResponse[];
}

export interface PrescriptionDetailPageResponse {
  items: PrescriptionDetailResponse[];
  page: number;
  page_size: number;
  total: number;
}
