import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TipoItemKardex } from '../../data-access/kardex.models';
import { KardexVistaComponent } from '../kardex-vista/kardex-vista';

export interface KardexDialogData {
  tipo: TipoItemKardex;
  itemId: string | null;
  titulo: string;
  subtitulo?: string;
}

/** Kardex de un insumo o de una presentación en un diálogo (la leche tiene su propia pestaña en Inventario). */
@Component({
  selector: 'app-kardex-dialog',
  imports: [KardexVistaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <div>
        <h2 id="kardex-titulo">Kardex · {{ data.titulo }}</h2>
        @if (data.subtitulo) { <p class="sub">{{ data.subtitulo }}</p> }
      </div>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="kardex-titulo">
      <app-kardex-vista [tipo]="data.tipo" [itemId]="data.itemId" />
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn" (click)="dialogRef.close()">Cerrar</button>
    </div>
  `,
  styles: `
    :host { display: block; width: min(60rem, 100%); background: var(--color-surface); border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 90vh; overflow: auto; }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .sub { color: var(--color-text-muted); font-size: var(--font-size-sm); margin: 0.25rem 0 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-4) var(--space-6); }
    .dialog-foot { display: flex; justify-content: flex-end; padding: 0 var(--space-6) var(--space-6); }
  `
})
export class KardexDialog {
  protected readonly dialogRef = inject(DialogRef<void>);
  protected readonly data = inject<KardexDialogData>(DIALOG_DATA);
}
