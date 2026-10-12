import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { PaginadorComponent } from '../../../../shared/ui/paginador/paginador';
import { paginaCorregida } from '../../../../shared/util/paginacion';
import { AjusteInventarioResponse } from '../../data-access/inventario.models';
import { InventarioApi } from '../../data-access/inventario.api';

/** El diálogo es angosto: páginas más cortas que en las tablas de pantalla completa. */
const TAMANO_PAGINA_AJUSTES = 10;

export interface HistorialAjustesDialogData {
  presentacionId: string;
  presentacionNombre: string;
  productoNombre: string;
}

/**
 * Inventario: historial de ajustes de stock de una presentación (solo lectura). Consulta bajo demanda,
 * nunca precargado con la tabla principal -- mismo patrón que HistorialPrecioDialog: diálogo separado, sin
 * apilar, con sus propios estados de carga/error/reintento.
 */
@Component({
  selector: 'app-historial-ajustes-dialog',
  imports: [DatePipe, PaginadorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="historial-ajustes-titulo">Ajustes de {{ data.presentacionNombre }}</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="historial-ajustes-titulo">
      <p class="hint">{{ data.productoNombre }}</p>
      @if (cargando()) {
        <p class="hint">Cargando ajustes…</p>
      } @else if (error()) {
        <p class="server-error" role="alert">{{ error()!.mensaje }}</p>
        <button type="button" class="btn small" (click)="cargar()">Reintentar</button>
      } @else if (ajustes().length === 0) {
        <p class="hint">Todavía no se registró ningún ajuste para esta presentación.</p>
      } @else {
        <table class="tabla-historico">
          <thead>
            <tr>
              <th>Fecha</th>
              <th class="align-end">Sistema</th>
              <th class="align-end">Conteo real</th>
              <th class="align-end">Diferencia</th>
              <th>Usuario</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            @for (a of ajustes(); track a.id) {
              <tr>
                <td>{{ a.creadoEn | date: 'short' }}</td>
                <td class="align-end">{{ a.cantidadAnterior }}</td>
                <td class="align-end">{{ a.cantidadCorregida }}</td>
                <td class="align-end">
                  <span class="badge" [class.blue]="a.delta > 0" [class.red]="a.delta < 0">{{ a.delta > 0 ? '+' : '' }}{{ a.delta }}</span>
                </td>
                <td>{{ a.usuarioNombre }}</td>
                <td>{{ a.motivo }}</td>
              </tr>
            }
          </tbody>
        </table>
        <ui-paginador
          [pagina]="pagina()"
          [totalPaginas]="totalPaginas()"
          [totalElementos]="totalElementos()"
          unidad="ajustes"
          (cambiar)="irAPagina($event)"
        />
      }
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn" (click)="dialogRef.close()">Cerrar</button>
    </div>
  `,
  styles: `
    :host {
      display: block; width: min(34rem, 100%); background: var(--color-surface);
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
    .badge { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; background: var(--color-surface-soft); color: var(--color-text-muted); font-size: 0.75rem; font-weight: 700; }
    .badge.blue { background: var(--color-info-bg, #dbeafe); color: var(--color-info, #2563eb); }
    .badge.red { background: var(--color-danger-bg); color: var(--color-danger); }
    .dialog-foot { display: flex; justify-content: flex-end; padding: 0 var(--space-6) var(--space-6); }
  `
})
export class HistorialAjustesDialog {
  protected readonly dialogRef = inject(DialogRef<void>);
  protected readonly data = inject<HistorialAjustesDialogData>(DIALOG_DATA);
  private readonly inventarioApi = inject(InventarioApi);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly ajustes = signal<AjusteInventarioResponse[]>([]);
  protected readonly pagina = signal(0);
  protected readonly totalElementos = signal(0);
  protected readonly totalPaginas = signal(0);
  private peticion?: Subscription;

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.peticion?.unsubscribe();
    this.peticion = this.inventarioApi
      .listarAjustes(this.data.presentacionId, { page: this.pagina(), size: TAMANO_PAGINA_AJUSTES })
      .subscribe({
      next: (respuesta) => {
        const corregida = paginaCorregida(respuesta);
        if (corregida !== null) {
          this.pagina.set(corregida);
          this.cargar();
          return;
        }
        this.ajustes.set(respuesta.contenido);
        this.totalElementos.set(respuesta.totalElementos);
        this.totalPaginas.set(respuesta.totalPaginas);
        this.cargando.set(false);
      },
      error: (error) => {
        this.error.set(mapHttpError(error));
        this.cargando.set(false);
      }
    });
  }

  protected irAPagina(pagina: number): void {
    if (pagina < 0 || pagina >= this.totalPaginas()) return;
    this.pagina.set(pagina);
    this.cargar();
  }
}
