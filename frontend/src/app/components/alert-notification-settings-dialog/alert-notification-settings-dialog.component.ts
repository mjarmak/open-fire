import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MarketDashboardService } from '../../market-dashboard.service';
import { dialogBackdropAnimation, dialogPanelAnimation } from '../dialog.animations';

@Component({
  selector: 'app-alert-notification-settings-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './alert-notification-settings-dialog.component.html',
  animations: [dialogBackdropAnimation, dialogPanelAnimation],
})
export class AlertNotificationSettingsDialogComponent {
  protected readonly state = inject(MarketDashboardService);
  @Output() closeDialog = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
}
