import { Component, input, output, signal } from '@angular/core';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const FILE_TYPES: Record<string, readonly string[]> = {
  pdf: ['application/pdf'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
};

@Component({
  selector: 'app-document-upload',
  imports: [],
  templateUrl: './document-upload.html',
  styleUrl: './document-upload.scss',
})
export class DocumentUpload {
  readonly inputId = input.required<string>();
  readonly label = input('Supporting documents');
  readonly files = input<readonly File[]>([]);
  readonly disabled = input(false);
  readonly externalError = input('');

  readonly filesChange = output<File[]>();
  readonly validationError = signal('');

  onFileSelected(event: Event): void {
    const element = event.target as HTMLInputElement;
    const selected = Array.from(element.files ?? []);

    // Allow the same file to be selected again after removal or failure.
    element.value = '';

    if (this.disabled() || selected.length === 0) {
      return;
    }

    this.validationError.set('');

    for (const file of selected) {
      if (file.size === 0) {
        this.validationError.set('Empty files cannot be selected.');
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        this.validationError.set('Each file must be 10 MiB or smaller.');
        return;
      }

      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      const allowedTypes = Object.hasOwn(FILE_TYPES, extension) ? FILE_TYPES[extension] : undefined;

      if (!allowedTypes) {
        this.validationError.set('Choose PDF, JPEG or PNG files.');
        return;
      }

      // Browser-reported MIME type is a preliminary check only.
      // Detected content type and readability require backend verification.
      if (file.type && !allowedTypes.includes(file.type.toLowerCase())) {
        this.validationError.set('The file type does not match its extension.');
        return;
      }
    }

    // Keep the previous selection when a replacement fails validation.
    this.filesChange.emit(selected);
  }

  removeFile(index: number): void {
    if (this.disabled()) {
      return;
    }

    this.validationError.set('');
    this.filesChange.emit(this.files().filter((_, itemIndex) => itemIndex !== index));
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} bytes`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KiB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  }
}
