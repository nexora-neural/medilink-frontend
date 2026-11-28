import { DatePipe, DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ActiveRoleService } from '../../../core/context/active-role.service';
import { SAMPLE_DOCTOR_ID } from '../data/prescription-draft.samples';
import {
  PRESCRIPTION_PDF_EXPORT,
  PrescriptionPdfExportRecord,
  prescriptionPdfExportProblems,
} from './prescription-pdf-export.models';

type ExportPageState = 'loading' | 'ready' | 'empty' | 'error' | 'denied';

@Component({
  selector: 'app-prescription-pdf-export',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './prescription-pdf-export.html',
  styleUrl: './prescription-pdf-export.scss',
})
export class PrescriptionPdfExport {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly roles = inject(ActiveRoleService);
  private readonly port = inject(PRESCRIPTION_PDF_EXPORT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private request = 0;
  private destroyed = false;

  readonly state = signal<ExportPageState>('loading');
  readonly record = signal<PrescriptionPdfExportRecord | null>(null);
  readonly downloading = signal(false);
  readonly downloadError = signal('');
  readonly downloadMessage = signal('');
  readonly permitted = computed(
    () => this.roles.activeRole() === 'Doctor' && this.roles.roles().includes('Doctor'),
  );
  readonly problems = computed(() => {
    const record = this.record();
    return record ? prescriptionPdfExportProblems(record, SAMPLE_DOCTOR_ID) : [];
  });
  readonly canDownload = computed(
    () =>
      this.permitted() &&
      this.state() === 'ready' &&
      !!this.record() &&
      this.problems().length === 0 &&
      !this.downloading(),
  );

  constructor() {
    effect(() => {
      if (!this.permitted()) {
        this.request++;
        this.record.set(null);
        this.state.set('denied');
        this.downloading.set(false);
        this.downloadError.set('');
        this.downloadMessage.set('');
      }
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.request++;
    });

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => void this.load());
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(() => void this.load());
  }

  async load(): Promise<void> {
    const request = ++this.request;
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const preview = this.route.snapshot.queryParamMap.get('preview');
    this.record.set(null);
    this.downloading.set(false);
    this.downloadError.set('');
    this.downloadMessage.set('');

    if (!this.permitted() || preview === 'denied') {
      this.state.set('denied');
      return;
    }

    this.state.set('loading');
    if (preview === 'loading') return;

    try {
      if (preview === 'error') throw new Error('Synthetic preview failure');
      let result = await this.port.load(id);
      if (!this.current(request)) return;
      if (preview === 'empty') result = null;
      if (result && preview === 'validation') {
        const [first, ...rest] = result.prescription.items;
        result = {
          ...result,
          prescription: {
            ...result.prescription,
            items: first ? [{ ...first, dose: '' }, ...rest] : [],
          },
        };
      }
      this.record.set(result);
      this.state.set(result ? 'ready' : 'empty');
    } catch {
      if (this.current(request)) this.state.set('error');
    }
  }

  async downloadPdf(): Promise<void> {
    this.downloadError.set('');
    this.downloadMessage.set('');

    if (!this.canDownload()) {
      this.downloadError.set('This prescription is not available for export.');
      return;
    }

    const record = this.record()!;
    const prescription = record.prescription;
    const version = prescription.version ?? 1;
    const request = this.request;
    this.downloading.set(true);

    try {
      if (this.route.snapshot.queryParamMap.get('preview') === 'download-error') {
        throw new Error('The sample PDF could not be prepared. Try again.');
      }
      const artifact = await this.port.download(prescription.id, version, prescription.updatedAt);
      if (!this.current(request)) return;
      if (artifact.version !== version || artifact.updatedAt !== prescription.updatedAt) {
        throw new Error('The prescription changed. Reload it to export the current version.');
      }
      this.saveBlob(artifact.blob, artifact.filename);
      this.downloadMessage.set(
        `Synthetic preview PDF downloaded for version ${artifact.version}. Real private downloads require the ML-190 API integration.`,
      );
    } catch (error) {
      if (this.current(request)) {
        this.downloadError.set(
          error instanceof Error
            ? error.message
            : 'Unable to prepare the PDF. Reload the prescription and try again.',
        );
      }
    } finally {
      if (this.current(request)) this.downloading.set(false);
    }
  }

  retry(): void {
    if (!this.permitted() || this.state() !== 'error') return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { preview: null },
      queryParamsHandling: 'merge',
    });
  }

  private saveBlob(blob: Blob, filename: string): void {
    const view = this.document.defaultView;
    if (!view || typeof URL.createObjectURL !== 'function') {
      throw new Error('This browser cannot download the sample PDF.');
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.hidden = true;
    this.document.body.append(link);
    link.click();
    link.remove();
    view.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  private current(request: number): boolean {
    return !this.destroyed && request === this.request && this.permitted();
  }
}
