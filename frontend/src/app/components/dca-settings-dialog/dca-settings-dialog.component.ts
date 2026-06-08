import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MarketDashboardService } from '../../market-dashboard.service';
import { dialogBackdropAnimation, dialogPanelAnimation } from '../dialog.animations';

@Component({
  selector: 'app-dca-settings-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dca-settings-dialog.component.html',
  animations: [dialogBackdropAnimation, dialogPanelAnimation],
})
export class DcaSettingsDialogComponent {
  protected readonly state = inject(MarketDashboardService);

  @Output() closeDialog = new EventEmitter<void>();
  @Output() configureTelegram = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  @Output() openSuggestions = new EventEmitter<void>();
  @Output() closeSuggestions = new EventEmitter<void>();
  @Output() copySuggestion = new EventEmitter<string>();
}

