import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { AuthService } from '../../../../core/auth/auth.service';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { ETIQUETA_ESTADO_LOTE } from '../../../inventario/data-access/lotes.models';
import { ADJUNTO_ACEPTA, TrazabilidadApi, problemaDeAdjunto } from '../../data-access/trazabilidad.api';
import { AdjuntoResponse, ETIQUETA_MOV, LoteInsumoTrazado, TrazabilidadResponse } from '../../data-access/trazabilidad.models';

/**
 * Trazabilidad por lote (PRODUCCION, CALIDAD y ADMIN): se escribe el código de un lote de insumo (o el que puso el proveedor) y se ve de
 * dónde vino (proveedor, documento y su recibo), todo lo que le pasó y en qué lotes de producción se usó. Con el id de un lote de producción
 * se ve de qué lotes de insumo salió cada insumo.
 */
@Component({
  selector: 'app-trazabilidad-page',
  imports: [DatePipe, DecimalPipe, FormsModule, LoadingStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">PRODUCCIÓN</div>
        <h1>Trazabilidad</h1>
        <p>Busca por código de lote de insumo (o el del proveedor) para ver su origen, su recibo y en qué producciones se usó.</p>
      </div>
    </div>

    <form class="busqueda" (ngSubmit)="buscar()" role="search" aria-label="Buscar trazabilidad de un lote">
      <label for="traza-q" class="visually-hidden">Código de lote</label>
      <input id="traza-q" type="search" name="q" [ngModel]="texto()" (ngModelChange)="texto.set($event)" placeholder="Código de lote (p. ej. AZU-20261029-01)" autocomplete="off">
      <button type="submit" class="btn primary" [disabled]="cargando()">Buscar</button>
    </form>
    @if (aviso()) { <p class="aviso" role="alert">{{ aviso() }}</p> }

    @if (cargando()) {
      <ui-loading-state mensaje="Buscando…" />
    } @else if (error()) {
      <ui-error-state [error]="error()" (reintentar)="buscar()" />
    } @else if (resultado(); as r) {
      @if (r.lotesInsumo.length === 0 && r.lotesProduccion.length === 0) {
        <p class="vacio" role="status">No hay lotes con «{{ r.consulta }}».</p>
      }
      @for (t of r.lotesInsumo; track t.lote.id) {
        <section class="card lote" [attr.aria-label]="'Lote ' + t.lote.codigo">
          <header>
            <h2>{{ t.lote.codigo }} <small>{{ t.lote.insumoNombre }}</small></h2>
            <span class="estado" [attr.data-estado]="t.lote.estado">{{ etiquetaEstado(t) }}</span>
          </header>
          <dl class="datos">
            <div><dt>Ingreso</dt><dd>{{ t.lote.fechaIngreso | date: 'dd/MM/yyyy' }}</dd></div>
            <div><dt>Vence</dt><dd>{{ t.lote.fechaVencimiento ? (t.lote.fechaVencimiento | date: 'dd/MM/yyyy') : '—' }}</dd></div>
            <div><dt>Inicial</dt><dd>{{ t.lote.cantidadInicial | number: '1.0-2' }} {{ t.lote.unidadMedida }}</dd></div>
            <div><dt>Disponible</dt><dd>{{ t.lote.cantidadDisponible | number: '1.0-2' }} {{ t.lote.unidadMedida }}</dd></div>
            <div><dt>Proveedor</dt><dd>{{ t.lote.proveedorNombre ?? '—' }}@if (t.lote.proveedorRuc) { <small>RUC {{ t.lote.proveedorRuc }}</small> }</dd></div>
            <div><dt>Lote del proveedor</dt><dd>{{ t.lote.codigoProveedor ?? '—' }}</dd></div>
          </dl>

          <h3>Documento y recibo</h3>
          @if (t.documento; as d) {
            <p>{{ d.tipo }} <strong>{{ d.numero ?? '—' }}</strong>@if (d.fecha) { · {{ d.fecha | date: 'dd/MM/yyyy' }} } · registrado por {{ d.usuarioNombre }}</p>
            <ul class="adjuntos">
              @for (a of t.adjuntos; track a.id) {
                <li><button type="button" class="row-link" (click)="ver(a)">{{ a.nombreOriginal }}</button> <small>{{ a.tamanoBytes / 1024 | number: '1.0-0' }} KB · {{ a.subidoPorNombre }}</small></li>
              } @empty { <li class="vacio">Sin recibo adjunto.</li> }
            </ul>
            @if (puedeAdjuntar()) {
              <label class="adjuntar">
                <span class="btn small">Adjuntar recibo (foto o PDF)</span>
                <input type="file" [accept]="acepta" capture="environment" class="visually-hidden" (change)="adjuntar(t, $any($event.target))">
              </label>
            }
          } @else {
            <p class="vacio">Este lote no tiene documento de ingreso (stock inicial o ingreso anterior al registro de documentos).</p>
          }

          <h3>Movimientos del lote</h3>
          <div class="tabla-scroll">
            <table class="tabla">
              <caption class="visually-hidden">Movimientos del lote {{ t.lote.codigo }}</caption>
              <thead><tr><th scope="col">Fecha</th><th scope="col">Movimiento</th><th scope="col" class="num">Cantidad</th><th scope="col">Usuario</th><th scope="col">Detalle</th></tr></thead>
              <tbody>
                @for (m of t.movimientos; track $index) {
                  <tr>
                    <td class="fecha">{{ m.fecha | date: 'dd/MM/yyyy HH:mm' }}</td>
                    <td>{{ etiquetaMov(m.tipo) }}</td>
                    <td class="num" [class.negativa]="m.cantidad < 0">{{ m.cantidad > 0 ? '+' : '' }}{{ m.cantidad | number: '1.0-2' }}</td>
                    <td>{{ m.usuarioNombre ?? '—' }}</td>
                    <td>{{ m.motivo ?? m.referencia ?? '' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <h3>En qué producciones se usó</h3>
          @if (t.producciones.length === 0) { <p class="vacio">Todavía no se usó en ninguna producción.</p> }
          <ul>
            @for (p of t.producciones; track p.loteProduccionId) {
              <li>{{ p.fecha | date: 'dd/MM/yyyy' }} · {{ p.productoNombre }} · {{ p.cantidad | number: '1.0-2' }} {{ t.lote.unidadMedida }} <small>lote de producción {{ p.loteProduccionId }}</small></li>
            }
          </ul>
        </section>
      }
      @for (p of r.lotesProduccion; track p.id) {
        <section class="card lote" [attr.aria-label]="'Lote de producción ' + p.id">
          <header><h2>Lote de producción <small>{{ p.productoNombre }} · {{ p.fecha | date: 'dd/MM/yyyy' }}</small></h2></header>
          @for (i of p.insumos; track i.insumoNombre) {
            <h3>{{ i.insumoNombre }}</h3>
            <ul>
              @for (l of i.lotes; track l.loteId) {
                <li><button type="button" class="row-link" (click)="buscarCodigo(l.codigo)">{{ l.codigo }}</button> · {{ l.cantidad | number: '1.0-2' }} {{ i.unidadMedida }}{{ l.proveedorNombre ? ' · ' + l.proveedorNombre : '' }}{{ l.fechaVencimiento ? ' · vence ' + (l.fechaVencimiento | date: 'dd/MM/yyyy') : '' }}</li>
              }
            </ul>
          } @empty { <p class="vacio">Este lote de producción no consumió insumos con lote registrado.</p> }
        </section>
      }
    }
  `,
  styles: `
    .busqueda { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); max-width: 40rem; }
    .busqueda input { flex: 1; }
    .aviso { color: var(--color-danger); font-weight: 600; }
    .vacio { color: var(--color-text-muted); }
    .lote { margin-bottom: var(--space-4); padding: var(--space-4); }
    .lote header { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-3); }
    .lote h2 { font-size: var(--font-size-lg); margin: 0; }
    .lote h3 { font-size: var(--font-size-sm); margin: var(--space-4) 0 var(--space-2); }
    small { color: var(--color-text-muted); font-size: 0.75rem; margin-left: 0.4rem; }
    .datos { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: var(--space-3); margin: var(--space-3) 0 0; }
    .datos dt { color: var(--color-text-muted); font-size: 0.75rem; }
    .datos dd { margin: 0.2rem 0 0; font-weight: 600; }
    .estado { border: 1px solid var(--color-border); border-radius: 999px; padding: 0.1rem 0.7rem; font-size: 0.75rem; font-weight: 700; }
    .estado[data-estado='POR_VENCER'] { color: var(--color-warning); border-color: var(--color-warning); }
    .estado[data-estado='VENCIDO'] { color: var(--color-danger); border-color: var(--color-danger); }
    .estado[data-estado='VIGENTE'] { color: var(--color-success); border-color: var(--color-success); }
    .adjuntos { list-style: none; padding: 0; margin: 0 0 var(--space-2); }
    .adjuntar { display: inline-block; cursor: pointer; }
    .tabla-scroll { overflow-x: auto; }
    .tabla { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
    .tabla th, .tabla td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--color-border); vertical-align: top; }
    .tabla thead th { color: var(--color-text-muted); font-size: 0.75rem; font-weight: 700; }
    .tabla .num { text-align: right; white-space: nowrap; }
    .tabla .fecha { white-space: nowrap; }
    .negativa { color: var(--color-danger); }
  `
})
export class TrazabilidadPage {
  private readonly api = inject(TrazabilidadApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly acepta = ADJUNTO_ACEPTA;
  protected readonly texto = signal('');
  protected readonly cargando = signal(false);
  protected readonly error = signal<AppError | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly resultado = signal<TrazabilidadResponse | null>(null);
  /** PRODUCCION y ADMIN adjuntan; CALIDAD solo consulta. */
  protected readonly puedeAdjuntar = computed(() => {
    const rol = this.auth.usuario()?.rolNombre;
    return rol === 'ADMIN' || rol === 'PRODUCCION';
  });

  protected etiquetaEstado(t: LoteInsumoTrazado): string {
    return ETIQUETA_ESTADO_LOTE[t.lote.estado];
  }

  protected etiquetaMov(tipo: string): string {
    return ETIQUETA_MOV[tipo] ?? tipo;
  }

  protected buscarCodigo(codigo: string): void {
    this.texto.set(codigo);
    this.buscar();
  }

  protected buscar(): void {
    const q = this.texto().trim();
    this.aviso.set(null);
    if (q.length < 2) {
      this.aviso.set('Escribe al menos 2 caracteres del código de lote.');
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    this.api.buscar(q).subscribe({
      next: (r) => {
        this.resultado.set(r);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mapHttpError(e));
        this.cargando.set(false);
      }
    });
  }

  /** Abre el recibo: el contenido exige sesión, así que se baja y se muestra con una dirección temporal del navegador. */
  protected ver(a: AdjuntoResponse): void {
    this.api.contenido(a.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (e) => this.toast.error(mapHttpError(e).mensaje)
    });
  }

  protected adjuntar(t: LoteInsumoTrazado, input: HTMLInputElement): void {
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo || !t.documento) return;
    const problema = problemaDeAdjunto(archivo);
    if (problema) {
      this.toast.error(problema);
      return;
    }
    this.api.adjuntar(t.documento.id, archivo).subscribe({
      next: () => {
        this.toast.exito('Recibo adjuntado.');
        this.buscar();
      },
      error: (e) => this.toast.error(mapHttpError(e).mensaje)
    });
  }
}
