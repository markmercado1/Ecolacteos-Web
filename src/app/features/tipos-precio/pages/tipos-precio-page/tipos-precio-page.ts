import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { CampoUnicoDialog, CampoUnicoDialogData } from '../../../../shared/ui/dialog/campo-unico-dialog';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { ETIQUETAS_REGLA, TipoPrecioResponse } from '../../data-access/tipo-precio.models';
import { TipoPrecioDialog } from '../../ui/tipo-precio-dialog/tipo-precio-dialog';
import { TiposPrecioApi } from '../../data-access/tipos-precio.api';

/**
 * Tipos de precio (solo ADMIN): crear, editar, activar o desactivar, con motivo (queda registrado quién y cuándo).
 * Un tipo desactivado deja de ofrecerse en los selectores de ventas y precios nuevos y el servidor lo rechaza; lo ya registrado conserva su
 * tipo y no cambia. También se crean tipos nuevos (con su regla de comprador) y se edita su nombre; el código es estable.
 */
@Component({
  selector: 'app-tipos-precio-page',
  imports: [DatePipe, ErrorStateComponent, LoadingStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-heading">
      <div>
        <div class="eyebrow">CONFIGURACIÓN</div>
        <h1>Tipos de precio</h1>
        <p>Un tipo desactivado deja de ofrecerse en ventas y precios nuevos. Lo ya registrado conserva su tipo y no cambia.</p>
      </div>
      <div class="heading-actions">
        <button type="button" class="btn primary" data-testid="nuevo-tipo" (click)="abrir(null)">Nuevo tipo</button>
      </div>
    </header>

    @if (cargando()) {
      <ui-loading-state />
    } @else if (error()) {
      <ui-error-state [error]="error()" (reintentar)="cargar()" />
    } @else {
      <div class="card card-pad">
        <div class="tabla-scroll" tabindex="0" role="region" aria-label="Tipos de precio">
          <table>
            <thead>
              <tr><th scope="col">Tipo</th><th scope="col">Para qué sirve</th><th scope="col">Compra</th><th scope="col">Estado</th><th scope="col">Último cambio</th><th scope="col"><span class="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody>
              @for (t of tipos(); track t.codigo) {
                <tr data-testid="tipo-precio">
                  <td><strong>{{ t.nombre }}</strong><div class="muted">{{ t.codigo }}</div></td>
                  <td>{{ t.descripcion }}</td>
                  <td data-testid="regla-tipo">{{ etiquetaRegla(t) }}</td>
                  <td><span class="badge" [class.gray]="!t.activo" data-testid="estado-tipo">{{ t.activo ? 'Activo' : 'Desactivado' }}</span></td>
                  <td>
                    @if (t.ultimoCambio; as c) {
                      <span class="muted">{{ c.activo ? 'Activado' : 'Desactivado' }}{{ c.usuarioNombre ? ' por ' + c.usuarioNombre : '' }} el {{ c.creadoEn | date: 'dd/MM/yyyy HH:mm' }} — {{ c.motivo }}</span>
                    } @else { <span class="muted">—</span> }
                  </td>
                  <td>
                    <button type="button" class="row-link" data-testid="editar-tipo" (click)="abrir(t)">Editar</button>
                    <button type="button" class="row-link" [class.peligro]="t.activo" data-testid="cambiar-estado" (click)="cambiar(t)">{{ t.activo ? 'Desactivar' : 'Activar' }}</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `
})
export class TiposPrecioPage {
  private readonly api = inject(TiposPrecioApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly tipos = signal<TipoPrecioResponse[]>([]);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.listar().subscribe({
      next: (t) => { this.tipos.set(t); this.cargando.set(false); },
      error: (e) => { this.error.set(mapHttpError(e)); this.cargando.set(false); }
    });
  }

  protected etiquetaRegla(t: TipoPrecioResponse): string {
    return ETIQUETAS_REGLA[t.reglaComprador];
  }

  /** null = crear un tipo; con un tipo, editar su nombre y descripción (el código y la regla no cambian). */
  protected abrir(tipo: TipoPrecioResponse | null): void {
    const ref = this.dialog.open<TipoPrecioResponse | undefined>(TipoPrecioDialog, { ariaLabel: tipo ? 'Editar tipo de precio' : 'Nuevo tipo de precio', data: { tipo } });
    ref.closed.subscribe((r) => {
      if (!r) return;
      this.toast.exito(tipo ? 'Tipo de precio actualizado.' : `Tipo «${r.nombre}» creado.`);
      this.cargar();
    });
  }

  protected cambiar(tipo: TipoPrecioResponse): void {
    const activar = !tipo.activo;
    const datos: CampoUnicoDialogData = {
      titulo: `${activar ? 'Activar' : 'Desactivar'} el tipo ${tipo.nombre}`,
      etiquetaCampo: 'Motivo',
      valorInicial: '',
      ayuda: activar
        ? 'Volverá a ofrecerse en ventas y precios nuevos.'
        : 'Dejará de ofrecerse en ventas y precios nuevos. Lo ya registrado conserva su tipo y no cambia.',
      etiquetaGuardar: activar ? 'Activar' : 'Desactivar',
      guardar: (motivo) => this.api.cambiarEstado(tipo.codigo, activar, motivo.trim())
    };
    const ref = this.dialog.open<unknown>(CampoUnicoDialog, { ariaLabel: datos.titulo, data: datos });
    ref.closed.subscribe((r) => {
      if (!r) return;
      this.toast.exito(`Tipo ${tipo.nombre} ${activar ? 'activado' : 'desactivado'}.`);
      this.cargar();
    });
  }
}
