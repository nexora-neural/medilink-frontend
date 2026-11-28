import { inject, Injectable } from '@angular/core';
import { AuthService, MeResponse } from '../../../../core/auth.service';

interface Page<T> {
  items: T[];
  total: number;
  page_size: number;
}

interface Dose {
  id: string;
  schedule_id: string;
  scheduled_for: string;
  status: string;
}

interface Schedule {
  schedule: { id: string; prescription_item_id: string };
  prescription_source: string | null;
}

interface Prescription {
  items: { id: string; medicine_name_snapshot: string; dose_text: string }[];
}

interface Notice {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class PatientDashboardApiService {
  private readonly auth = inject(AuthService);

  async load(now: Date) {
    const me = await this.auth.getAuthorized<MeResponse>('me');
    const patient = me.patient_profile;
    if (!patient || patient.user_id !== me.user.id) {
      throw { status: 403 };
    }

    const patientPath = `patients/${encodeURIComponent(patient.user_id)}`;
    const days = Array.from(
      { length: 8 },
      (_, index) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + index - 6),
    );
    const bounds = new URLSearchParams({ from: days[0].toISOString(), to: days[7].toISOString() });
    const [doses, notices] = await Promise.all([
      this.all<Dose>(`${patientPath}/dose-occurrences?${bounds}`),
      this.auth.getAuthorized<Page<Notice>>('me/notifications?page=1&page_size=5'),
    ]);

    const visible = doses.filter((dose) => dose.status !== 'cancelled');
    const today = visible.filter((dose) => Date.parse(dose.scheduled_for) >= +days[6]);
    const [schedules, prescriptions] = today.length
      ? await Promise.all([
          this.all<Schedule>(`${patientPath}/medication-schedules`),
          this.all<Prescription>(`${patientPath}/prescriptions`),
        ])
      : [[], []];

    const schedulesById = new Map(schedules.map((item) => [item.schedule.id, item]));
    const itemsById = new Map(
      prescriptions.flatMap((record) => record.items.map((item) => [item.id, item] as const)),
    );
    const timeFormat = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return {
      name: me.user.display_name,
      medicines: today.map((dose) => {
        const schedule = schedulesById.get(dose.schedule_id);
        const item = schedule && itemsById.get(schedule.schedule.prescription_item_id);
        const source = schedule?.prescription_source;
        return {
          id: dose.id,
          name: item?.medicine_name_snapshot ?? 'Medication reminder',
          dose: item?.dose_text ?? '',
          time: timeFormat.format(new Date(dose.scheduled_for)),
          source:
            source === 'doctor'
              ? 'Doctor-issued'
              : source === 'patient'
                ? 'Patient-added · Not clinically verified'
                : source === 'approved_external_system'
                  ? 'External system'
                  : '',
        };
      }),
      takenCount: today.filter((dose) => dose.status === 'taken').length,
      notices: notices.items.map((notice) => ({
        ...notice,
        date: new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
          new Date(notice.created_at),
        ),
      })),
      weekActivity: days.slice(0, 7).map((day, index) => {
        const entries = visible.filter((dose) => {
          const time = Date.parse(dose.scheduled_for);
          return time >= +day && time < +days[index + 1];
        });
        const taken = entries.filter((dose) => dose.status === 'taken').length;
        return {
          label: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(day),
          date: day.toISOString(),
          taken,
          total: entries.length,
          height: entries.length ? (taken / entries.length) * 100 : 0,
        };
      }),
    };
  }

  private async all<T>(path: string): Promise<T[]> {
    const results: T[] = [];
    const separator = path.includes('?') ? '&' : '?';
    for (let page = 1; ; page++) {
      const response = await this.auth.getAuthorized<Page<T>>(
        `${path}${separator}page=${page}&page_size=100`,
      );
      results.push(...response.items);
      if (!response.items.length || page * response.page_size >= response.total) return results;
    }
  }
}
