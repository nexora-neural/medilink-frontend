import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocumentUpload } from './document-upload';

describe('DocumentUpload', () => {
  let fixture: ComponentFixture<DocumentUpload>;
  let emitted: File[][];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentUpload],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentUpload);
    fixture.componentRef.setInput('inputId', 'test-document');
    emitted = [];

    fixture.componentInstance.filesChange.subscribe((files) => {
      emitted.push(files);
      fixture.componentRef.setInput('files', files);
    });

    fixture.detectChanges();
  });

  function selectFiles(files: File[]): HTMLInputElement {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: files,
    });

    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    return input;
  }

  it('labels the file input and shows the empty selection', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('label')?.htmlFor).toBe('test-document');
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'No documents selected',
    );
  });

  it('accepts PDF, JPEG and PNG selections and displays their names', () => {
    const files = [
      new File(['pdf'], 'evidence.pdf', { type: 'application/pdf' }),
      new File(['jpeg'], 'photo.jpeg', { type: 'image/jpeg' }),
      new File(['png'], 'report.png', { type: 'image/png' }),
    ];

    selectFiles(files);

    expect(emitted).toEqual([files]);
    expect(fixture.nativeElement.querySelectorAll('.file-row')).toHaveLength(3);

    for (const file of files) {
      expect(fixture.nativeElement.textContent).toContain(file.name);
    }
  });

  it('accepts exactly 10 MiB and rejects a file one byte larger', () => {
    const boundary = new File([new Uint8Array(10 * 1024 * 1024)], 'limit.pdf', {
      type: 'application/pdf',
    });

    selectFiles([boundary]);
    expect(emitted).toEqual([[boundary]]);

    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.pdf', {
      type: 'application/pdf',
    });

    selectFiles([oversized]);

    expect(emitted).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      '10 MiB or smaller',
    );
    expect(fixture.componentInstance.files()).toEqual([boundary]);
  });

  it('rejects empty files', () => {
    selectFiles([new File([], 'empty.pdf', { type: 'application/pdf' })]);

    expect(emitted).toEqual([]);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Empty files',
    );
  });

  it('rejects unsupported extensions and associates the error with the input', () => {
    const input = selectFiles([new File(['text'], 'notes.txt', { type: 'text/plain' })]);

    expect(emitted).toEqual([]);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain('test-document-error');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Choose PDF, JPEG or PNG',
    );
  });

  it('rejects a browser MIME type that conflicts with the extension', () => {
    selectFiles([new File(['text'], 'report.pdf', { type: 'text/plain' })]);

    expect(emitted).toEqual([]);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'does not match',
    );
  });

  it('preserves the previous selection when any replacement file is invalid', () => {
    const original = new File(['pdf'], 'original.pdf', { type: 'application/pdf' });
    selectFiles([original]);

    selectFiles([
      new File(['png'], 'replacement.png', { type: 'image/png' }),
      new File(['text'], 'invalid.txt', { type: 'text/plain' }),
    ]);

    expect(emitted).toEqual([[original]]);
    expect(fixture.componentInstance.files()).toEqual([original]);
    expect(fixture.nativeElement.textContent).toContain('original.pdf');
  });

  it('preserves the selection when the file picker is cancelled', () => {
    const original = new File(['pdf'], 'original.pdf', { type: 'application/pdf' });
    selectFiles([original]);
    selectFiles([]);

    expect(emitted).toEqual([[original]]);
    expect(fixture.componentInstance.files()).toEqual([original]);
  });

  it('removes a selected file and permits selecting it again', () => {
    const file = new File(['pdf'], 'evidence.pdf', { type: 'application/pdf' });
    const input = selectFiles([file]);

    const remove = fixture.nativeElement.querySelector(
      'button[aria-label="Remove evidence.pdf"]',
    ) as HTMLButtonElement;

    remove.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.files()).toEqual([]);
    expect(input.value).toBe('');

    selectFiles([file]);
    expect(fixture.componentInstance.files()).toEqual([file]);
    expect(emitted).toEqual([[file], [], [file]]);
  });

  it('disables selection and removal while busy', () => {
    const file = new File(['pdf'], 'evidence.pdf', { type: 'application/pdf' });
    fixture.componentRef.setInput('files', [file]);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const remove = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(input.disabled).toBe(true);
    expect(remove.disabled).toBe(true);

    selectFiles([new File(['png'], 'new.png', { type: 'image/png' })]);
    fixture.componentInstance.removeFile(0);

    expect(emitted).toEqual([]);
    expect(fixture.componentInstance.files()).toEqual([file]);
  });

  it('displays a validation error supplied by the parent page', () => {
    fixture.componentRef.setInput('externalError', 'Please select supporting evidence.');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Please select supporting evidence.',
    );
    expect(fixture.nativeElement.querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
  });
});
