import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { InformeProduccionDiario } from '../../data-access/informe-produccion.models';

export interface InformeDetalleDialogData {
  informe: InformeProduccionDiario;
}

/**
 * Solo lectura. Un informe de una fecha pasada no se puede editar (regla de negocio en backend, ver
 * InformeProduccionDiarioService.editar) -- esta es la única acción que ofrece el historial para esas
 * filas. Reutiliza el objeto que ya trajo el listado paginado (InformesProduccionApi.listar ya incluye
 * insumos por fila): no hace ninguna llamada nueva a la API.
 */
@Component({
  selector: 'app-informe-detalle-dialog',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="informe-detalle-titulo">Informe del {{ data.informe.fecha }}</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="informe-detalle-titulo">
      <p class="hint">
        Solo lectura -- ya no es el día de hoy, no se puede editar.
        Creado por {{ data.informe.responsableNombre }}
        @if (data.informe.actualizadoPorNombre) { · última edición de {{ data.informe.actualizadoPorNombre }} }.
      </p>
      <dl>
        <div><dt>Quesos diarios</dt><dd>{{ data.informe.quesosDiarios }}</dd></div>
        <div><dt>Quesos reparados</dt><dd>{{ data.informe.quesosReparados }}</dd></div>
        <div><dt>Quesos de recorte</dt><dd>{{ data.informe.quesosDeRecorte }}</dd></div>
        <div><dt>Total de quesos</dt><dd>{{ data.informe.totalQuesos }}</dd></div>
        <div>
          <dt>Recorte en kilos</dt>
          <dd>{{ data.informe.recorteEnKilos === null ? 'Sin dato' : (data.informe.recorteEnKilos | number: '1.0-2') + ' kg' }}</dd>
        </div>
      </dl>

      <div class="section-head"><h3>Insumos usados</h3></div>
      @if (data.informe.insumos.length === 0) {
        <p class="hint">Sin insumos registrados ese día.</p>
      } @else {
        <table class="tabla-insumos">
          <thead><tr><th>Insumo</th><th>Cantidad</th><th>Unidad</th></tr></thead>
          <tbody>
            @for (i of data.informe.insumos; track i.insumoId) {
              <tr><td>{{ i.insumoNombre }}</td><td>{{ i.cantidad }}</td><td>{{ i.unidadMedida }}</td></tr>
            }
          </tbody>
        </table>
      }
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn" (click)="dialogRef.close()">Cerrar</button>
    </div>
  `,
  styles: `
    :host {
      display: block; width: min(32rem, calc(100vw - 2rem)); max-height: 85vh; overflow: auto;
      background: var(--color-surface); border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay);
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-4) var(--space-6); }
    .hint { color: var(--color-text-muted); font-size: var(--font-size-sm); }
    dl { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3) var(--space-4); margin: var(--space-4) 0; }
    dt { color: var(--color-text-muted); font-size: 0.75rem; }
    dd { margin: 0.2rem 0 0; font-weight: 600; }
    .section-head { margin: var(--space-5) 0 var(--space-2); }
    .section-head h3 { font-size: var(--font-size-sm); font-weight: 800; margin: 0; }
    .tabla-insumos { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
    .tabla-insumos th, .tabla-insumos td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--color-border); }
    .dialog-foot { display: flex; justify-content: flex-end; padding: 0 var(--space-6) var(--space-6); }
    @media (max-width: 480px) { dl { grid-template-columns: 1fr; } }
  `
})
export class InformeDetalleDialog {
  protected readonly dialogRef = inject(DialogRef<void>);
  protected readonly data = inject<InformeDetalleDialogData>(DIALOG_DATA);
}
