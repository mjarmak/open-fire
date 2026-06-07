import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { MarketDashboardService } from '../../market-dashboard.service';

@Component({
  selector: 'app-dca-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dca-panel.component.html',
})
export class DcaPanelComponent {
  protected readonly state = inject(MarketDashboardService);

  @Output() configureDca = new EventEmitter<void>();

  get dcaSummaryText(): string {
    const note = this.state.dcaReminderNote.trim();
    return note.length ? note : 'No custom DCA note set yet.';
  }

  get dcaDaysText(): string {
    return this.state.formatNotificationDays(this.state.dcaReminderDays);
  }
}

