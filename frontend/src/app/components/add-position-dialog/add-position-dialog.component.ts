import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SymbolSearchResult } from '../../market-dashboard.models';
import { MarketDashboardService } from '../../market-dashboard.service';
import { dialogBackdropAnimation, dialogPanelAnimation } from '../dialog.animations';

@Component({
  selector: 'app-add-position-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-position-dialog.component.html',
  animations: [dialogBackdropAnimation, dialogPanelAnimation],
})
export class AddPositionDialogComponent {
  protected readonly state = inject(MarketDashboardService);

  @Output() closeDialog = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  @Output() search = new EventEmitter<void>();
  @Output() openDropdown = new EventEmitter<void>();
  @Output() chooseSymbol = new EventEmitter<SymbolSearchResult>();
}
