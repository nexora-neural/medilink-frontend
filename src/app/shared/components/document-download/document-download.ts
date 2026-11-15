import { Component, input, output } from '@angular/core';

export interface DownloadDocument {
  id: string;
  name: string;
}

@Component({
  selector: 'app-document-download',
  imports: [],
  templateUrl: './document-download.html',
  styleUrl: './document-download.scss',
})
export class DocumentDownload {
  readonly document = input<DownloadDocument | null>(null);
  readonly loading = input(false);
  readonly disabled = input(false);
  readonly error = input('');
  readonly message = input('');

  readonly downloadRequested = output<string>();

  requestDownload(): void {
    const document = this.document();

    if (!document || this.loading() || this.disabled()) {
      return;
    }

    this.downloadRequested.emit(document.id);
  }
}
