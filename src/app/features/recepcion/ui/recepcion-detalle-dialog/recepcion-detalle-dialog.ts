import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { JornadaDetalleDialog } from '../../../jornadas/ui/jornada-detalle-dialog/jornada-detalle-dialog';
import { BarChartComponent, BarraChart } from '../../../../shared/ui/chart/bar-chart';
import { RecepcionPlanta } from '../../data-access/recepcion.models';

/**
 * Solo lectura: litros de campo/planta, diferencia, estado y registros vinculados (Bloque 3 de Fase 4).
 * No resuelve cada registroAcopioId a su detalle completo: GET /api/registros-acopio/{id} no está
 * autorizado para RECEPCION (docs/ENDPOINTS.md), así que solo se listan los identificadores del contrato.
 */
@Component({
  selector: 'app-recepcion-detalle-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, BarChartComponent],
  template: `
    <header>
      <div>
        <div class="eyebrow">RECEPCIÓN</div>
        <h2>Detalle de la recepción</h2>
      </div>
      <button class="btn" (click)="ref.close()" aria-label="Cerrar detalle">×</button>
    </header>

    <ui-bar-chart
      titulo="Litros de campo vs. litros de planta"
      [subtitulo]="'Recepción del ' + data.recepcion.fecha + ' · ' + data.placa"
      unidad="L"
      [datos]="datosComparacion()"
      [decimales]="3"
    />
    <p class="diferencia-texto">
      Diferencia: {{ data.recepcion.diferenciaLitros | number: '1.0-3' }} L ({{ data.recepcion.diferenciaPct | number: '1.0-2' }}%)
      · <span class="badge" [class.red]="data.recepcion.estado === 'ALERTA'">{{ data.recepcion.estado }}</span>
    </p>

    <dl>
      <div>
        <dt>Fecha</dt>
        <dd>{{ data.recepcion.fecha }} · {{ data.recepcion.turno }}</dd>
      </div>
      <div>
        <dt>Vehículo</dt>
        <dd>{{ data.placa }}</dd>
      </div>
      <div>
        <dt>Hora de llegada</dt>
        <dd>{{ data.recepcion.horaLlegada ?? 'No informada' }}</dd>
      </div>
      <div>
        <dt>Litros registrados en acopio</dt>
        <dd>{{ data.recepcion.litrosRegistradosAcopio | number: '1.0-3' }} L</dd>
      </div>
      <div>
        <dt>Observación</dt>
        <dd>{{ data.recepcion.observacion || 'Sin observación' }}</dd>
      </div>
    </dl>

    <h3>Registros de acopio vinculados ({{ data.recepcion.registroAcopioIds.length }})</h3>
    @if (data.recepcion.registroAcopioIds.length === 0) {
      <p>Esta recepción no tiene registros de acopio vinculados.</p>
    } @else {
      <ul class="lista-ids">
        @for (id of data.recepcion.registroAcopioIds; track id) {
          <li>{{ id }}</li>
        }
      </ul>
    }

    @if (data.recepcion.jornadaId) {
      <button type="button" class="btn" (click)="verJornada()">Ver jornada vinculada</button>
    }
  `,
  styles: `
    :host {
      display: block;
      width: min(36rem, calc(100vw - 2rem));
      max-height: 85vh;
      overflow: auto;
      padding: var(--space-6);
      background: var(--color-surface);
      border-radius: var(--radius-dialog);
    }
    header { display: flex; justify-content: space-between; align-items: start; gap: 1rem; }
    h2 { margin-top: 0; }
    h3 { margin-top: var(--space-6); }
    ui-bar-chart { display: block; margin-top: var(--space-4); }
    .diferencia-texto { color: var(--color-text-muted); font-size: var(--font-size-sm); margin-top: var(--space-3); }
    dl { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: var(--space-4); }
    dt { color: var(--color-text-muted); font-size: 0.8rem; }
    dd { margin: 0.3rem 0 0; overflow-wrap: anywhere; }
    .lista-ids { margin: 0; padding-left: var(--space-6); font-size: var(--font-size-sm); overflow-wrap: anywhere; }
    @media (max-width: 600px) {
      dl { grid-template-columns: 1fr; }
    }
  `,
})
export class RecepcionDetalleDialog {
  protected readonly ref = inject(DialogRef);
  protected readonly data = inject<{ recepcion: RecepcionPlanta; placa: string }>(DIALOG_DATA);
  private readonly dialog = inject(Dialog);

  protected readonly datosComparacion = computed<BarraChart[]>(() => [
    { etiqueta: 'Campo', valor: this.data.recepcion.litrosCampo },
    { etiqueta: 'Planta', valor: this.data.recepcion.litrosPlanta },
  ]);

  protected verJornada(): void {
    const jornadaId = this.data.recepcion.jornadaId;
    if (!jornadaId) return;
    this.dialog.open(JornadaDetalleDialog, {
      ariaLabel: 'Detalle de la jornada vinculada',
      data: { id: jornadaId },
    });
  }
}
