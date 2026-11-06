import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type OrganizationStatus = 'Approved' | 'Pending' | 'Rejected' | 'Suspended';
interface Organization { id: number; name: string; type: string; status: OrganizationStatus; }

@Component({
  selector: 'app-admin-organizations',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './organizations.html',
  styleUrl: './organizations.scss',
})
export class Organizations {
  readonly organizations: Organization[] = [
    { id: 1, name: 'Lakeside Clinic', type: 'Clinic', status: 'Approved' },
    { id: 2, name: 'Central Laboratory', type: 'Laboratory', status: 'Pending' },
    { id: 3, name: 'Lakeside Pharmacy', type: 'Pharmacy', status: 'Approved' },
  ];
  loading = false;
  showError = false;
}
