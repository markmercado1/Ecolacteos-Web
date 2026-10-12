import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { PrecioQuesoResponse } from '../../data-access/precio-queso.models';
import { PreciosQuesoApi } from '../../data-access/precios-queso.api';

export interface HistorialPrecioDialogData {
  productoNombre: string;
  presentacionNombre: string;
  presentacionId: string;
}

const ETIQUETAS_MODALIDAD: Record<PrecioQuesoResponse['modalidad'], string> = {
  MAYORISTA: 'Mayorista',
  PROVEEDOR: 'Proveedor',
  PUBLICO: 'Público'
};

/**
 * Fase 2 (Precios por presentación): "Ver histórico" es un diálogo separado, nunca una tabla incrustada
 * debajo de otro formulario. Ampliación (pantalla /precios paginada por familia): consulta bajo demanda
 * solo el histórico de ESTA presentación (`GET /admin/precios-queso?presentacionId=`), nunca el histórico
 * completo del catálogo -- con sus propios estados de carga/error/reintento, mismo patrón que el resto de
 * diálogos de esta sección.
 */
@Component({
  selector: 'app-historial-precio-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="historial-precio-titulo">Histórico de {{ data.presentacionNombre }}</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="historial-precio-titulo">
      <p class="hint">{{ data.productoNombre }}</p>
      @if (cargando()) {
        <p class="hint">Cargando histórico…</p>
      } @else if (error()) {
        <p class="server-error" role="alert">{{ error()!.mensaje }}</p>
        <button type="button" class="btn small" (click)="cargar()">Reintentar</button>
      } @else if (ordenados().length === 0) {
        <p class="hint">Todavía no se registró ningún precio para esta presentación.</p>
      } @else {
        <table class="tabla-historico">
          <thead>
            <tr>
              <th>Modalidad</th>
              <th>Vigente desde</th>
              <th class="align-end">Precio</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            @for (p of ordenados(); track p.id) {
              <tr>
                <td>{{ etiquetaModalidad(p.modalidad) }}</td>
                <td>{{ p.vigenteDesde }}</td>
                <td class="align-end">S/ {{ p.precio }}</td>
                <td>
                  <span class="badge" [class.blue]="estadoDe(p) === 'Programado'" [class.gray]="estadoDe(p) === 'Anterior'">
                    {{ estadoDe(p) }}
                  </span>
                </td>
              </tr>
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
      display: block; width: min(28rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 85vh; overflow: auto;
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-4) var(--space-6); }
    .hint { color: var(--color-text-muted); font-size: var(--font-size-sm); margin: 0 0 var(--space-3); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-3); }
    .tabla-historico { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
    .tabla-historico th, .tabla-historico td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--color-border); }
    .tabla-historico th.align-end, .tabla-historico td.align-end { text-align: right; }
    .badge { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; background: var(--color-success-bg, #dcfce7); color: var(--color-success, #16a34a); font-size: 0.75rem; }
    .badge.blue { background: var(--color-info-bg, #dbeafe); color: var(--color-info, #2563eb); }
    .badge.gray { background: var(--color-border); color: var(--color-text-muted); }
    .dialog-foot { display: flex; justify-content: flex-end; padding: 0 var(--space-6) var(--space-6); }
  `
})
export class HistorialPrecioDialog {
  protected readonly dialogRef = inject(DialogRef<void>);
  protected readonly data = inject<HistorialPrecioDialogData>(DIALOG_DATA);
  private readonly preciosQuesoApi = inject(PreciosQuesoApi);

  private readonly hoyIso = new Date().toISOString().slice(0, 10);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  private readonly precios = signal<PrecioQuesoResponse[]>([]);

  protected readonly ordenados = computed(() =>
    [...this.precios()].sort((a, b) => (a.vigenteDesde < b.vigenteDesde ? 1 : -1))
  );

  /** Vigente = de esta modalidad, la de vigenteDesde más reciente que ya empezó. */
  protected readonly vigentesPorModalidad = computed(() => {
    const mapa = new Map<string, PrecioQuesoResponse>();
    for (const p of this.ordenados()) {
      if (p.vigenteDesde > this.hoyIso) continue;
      const actual = mapa.get(p.modalidad);
      if (!actual || p.vigenteDesde > actual.vigenteDesde) mapa.set(p.modalidad, p);
    }
    return mapa;
  });

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.preciosQuesoApi.listar(this.data.presentacionId).subscribe({
      next: (precios) => {
        this.precios.set(precios);
        this.cargando.set(false);
      },
      error: (error) => {
        this.error.set(mapHttpError(error));
        this.cargando.set(false);
      }
    });
  }

  protected estadoDe(precio: PrecioQuesoResponse): 'Vigente' | 'Programado' | 'Anterior' {
    if (precio.vigenteDesde > this.hoyIso) return 'Programado';
    if (this.vigentesPorModalidad().get(precio.modalidad)?.id === precio.id) return 'Vigente';
    return 'Anterior';
  }

  protected etiquetaModalidad(modalidad: PrecioQuesoResponse['modalidad']): string {
    return ETIQUETAS_MODALIDAD[modalidad];
  }
}
