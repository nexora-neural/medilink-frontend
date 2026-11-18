import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../../core/auth.service';

export interface MedicineInput {
  generic_name: string;
  brand_name: string | null;
  strength: string | null;
  form: string | null;
}

export interface CatalogueMedicine {
  id: string;
  genericName: string;
  brand: string | null;
  strength: string | null;
  form: string | null;
  isSample: boolean;
}

interface MedicineResponse extends MedicineInput {
  id: string;
  is_sample: boolean;
}

interface MedicinePageResponse {
  items: MedicineResponse[];
  page: number;
  page_size: number;
  total: number;
}

export interface MedicinePage {
  items: CatalogueMedicine[];
  page: number;
  pageSize: number;
  total: number;
}

export function isCatalogueAccessError(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
}

@Injectable({ providedIn: 'root' })
export class MedicineCatalogueApi {
  private readonly auth = inject(AuthService);

  search(query: string, page = 1): Promise<MedicinePage> {
    return this.readPage('medicines', page, query);
  }

  listForManagement(page = 1): Promise<MedicinePage> {
    return this.readPage('admin/medicines', page);
  }

  create(input: MedicineInput): Promise<MedicineResponse> {
    return this.auth.postAuthorized<MedicineResponse>('admin/medicines', input);
  }

  private async readPage(path: string, page: number, query = ''): Promise<MedicinePage> {
    const params = new URLSearchParams({ page: String(page), page_size: '20' });
    const term = query.trim();
    if (term) params.set('q', term);

    const response = await this.auth.getAuthorized<MedicinePageResponse>(
      `${path}?${params.toString()}`,
    );

    return {
      items: response.items.map((row) => ({
        id: row.id,
        genericName: row.generic_name,
        brand: row.brand_name,
        strength: row.strength,
        form: row.form,
        isSample: row.is_sample,
      })),
      page: response.page,
      pageSize: response.page_size,
      total: response.total,
    };
  }
}
