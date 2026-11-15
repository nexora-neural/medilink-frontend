import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocumentDownload } from './document-download';

describe('DocumentDownload', () => {
  let fixture: ComponentFixture<DocumentDownload>;
  let requestedIds: string[];

  const document = {
    id: 'document-1',
    name: 'Sample evidence.pdf',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentDownload],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentDownload);
    requestedIds = [];

    fixture.componentInstance.downloadRequested.subscribe((id) => {
      requestedIds.push(id);
    });

    fixture.detectChanges();
  });

  function showDocument(): void {
    fixture.componentRef.setInput('document', document);
    fixture.detectChanges();
  }

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  }

  it('shows an empty state without a download button', () => {
    expect(fixture.nativeElement.textContent).toContain('No document available to download.');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();

    fixture.componentInstance.requestDownload();

    expect(requestedIds).toEqual([]);
  });

  it('shows the document name and emits its record ID when clicked', () => {
    showDocument();

    expect(fixture.nativeElement.textContent).toContain(document.name);
    expect(button().getAttribute('aria-label')).toBe('Download Sample evidence.pdf');

    button().click();

    expect(requestedIds).toEqual(['document-1']);
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
  });

  it('announces loading and prevents duplicate requests', () => {
    showDocument();
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect(button().disabled).toBe(true);
    expect(
      fixture.nativeElement.querySelector('.document-download')?.getAttribute('aria-busy'),
    ).toBe('true');
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'Preparing document for download',
    );

    button().click();
    fixture.componentInstance.requestDownload();

    expect(requestedIds).toEqual([]);
  });

  it('prevents requests when disabled by the parent', () => {
    showDocument();
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    expect(button().disabled).toBe(true);

    button().click();
    fixture.componentInstance.requestDownload();

    expect(requestedIds).toEqual([]);
  });

  it('shows a download error and permits retry using the same record ID', () => {
    showDocument();
    fixture.componentRef.setInput('error', 'The document could not be downloaded.');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'The document could not be downloaded.',
    );
    expect(button().textContent).toContain('Try again');
    expect(button().getAttribute('aria-label')).toBe('Retry download of Sample evidence.pdf');

    button().click();

    expect(requestedIds).toEqual(['document-1']);
  });

  it('announces a message supplied by the parent', () => {
    showDocument();
    fixture.componentRef.setInput('message', 'Preview only. No document was downloaded.');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'Preview only. No document was downloaded.',
    );
  });
});
