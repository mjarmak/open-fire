import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MarketDashboardService } from '../../market-dashboard.service';
import { dialogBackdropAnimation, dialogPanelAnimation } from '../dialog.animations';

@Component({
  selector: 'app-retirement-settings-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './retirement-settings-dialog.component.html',
  animations: [dialogBackdropAnimation, dialogPanelAnimation],
})
export class RetirementSettingsDialogComponent {
  protected readonly state = inject(MarketDashboardService);

  @Output() closeDialog = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
}
