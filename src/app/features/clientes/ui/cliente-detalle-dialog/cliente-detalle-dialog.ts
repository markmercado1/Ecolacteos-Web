import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import {
  ClienteResponse,
  CompraResponse,
  ConsentimientoResponse,
  CompradorSugerencia,
  ETIQUETAS_FORMA,
  ETIQUETAS_MEDIO,
  FormaAutorizacion,
  HistorialClienteResponse,
  MEDIOS_COMERCIALES,
  MedioComercial,
  criterioDeBusqueda
} from '../../data-access/cliente.models';
import { ClientesApi } from '../../data-access/clientes.api';

export interface ClienteDetalleDialogData {
  id: string;
  esAdmin: boolean;
}

/**
 * Fase H: ficha de un cliente. Datos (completos solo para ADMIN), teléfonos, autorización de promociones (otorgar o revocar, con la
 * misma facilidad), historial de compras y reservas con indicadores del año en curso, evidencia de autorizaciones y, solo ADMIN,
 * condición de mayorista y fusión manual con otra ficha.
 */
@Component({
  selector: 'app-cliente-detalle-dialog',
  imports: [DatePipe, DecimalPipe, LoadingStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="cliente-titulo">{{ cliente()?.nombre ?? 'Cliente' }}</h2>
      <button type="button" class="close" (click)="dialogRef.close(cambios)" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-body" aria-labelledby="cliente-titulo">
      @if (cargando()) {
        <ui-loading-state mensaje="Cargando ficha…" />
      } @else if (error()) {
        <ui-error-state [error]="error()" (reintentar)="cargar()" />
      } @else if (cliente(); as c) {
        @if (c.fusionadoEnId) { <p class="aviso">Esta ficha se fusionó en otra: sus compras y teléfonos están en la ficha destino.</p> }
        @if (!c.activo && !c.fusionadoEnId) { <p class="aviso">Ficha desactivada: no se usa en ventas nuevas.</p> }
        <dl class="datos">
          <div><dt>Tipo</dt><dd>{{ c.tipoPersona === 'EMPRESA' ? 'Empresa' : 'Persona natural' }}{{ c.mayorista ? ' · Mayorista' : '' }}</dd></div>
          @if (c.razonSocial) { <div><dt>Razón social</dt><dd>{{ c.razonSocial }}</dd></div> }
          <div><dt>DNI</dt><dd>{{ c.dni ?? '—' }}</dd></div>
          <div><dt>RUC</dt><dd>{{ c.ruc ?? '—' }}</dd></div>
          <div><dt>Correo</dt><dd>{{ c.correo ?? '—' }}</dd></div>
          <div><dt>Teléfonos</dt><dd data-testid="telefonos">{{ c.telefonos.join(' · ') }}</dd></div>
          <div><dt>Registrado</dt><dd>{{ c.creadoEn | date: 'dd/MM/yyyy' }}{{ c.registro.forma ? ' · ' + forma(c.registro.forma) : '' }}</dd></div>
        </dl>
        @if (!c.datosCompletos) { <p class="nota">Teléfonos y documentos se muestran ocultos; ADMIN los ve completos.</p> }

        @if (!c.fusionadoEnId) {
          <div class="fila-accion">
            <input type="tel" [value]="nuevoTelefono()" (input)="nuevoTelefono.set($any($event.target).value)" placeholder="Agregar teléfono" aria-label="Agregar teléfono">
            <button type="button" class="btn small" [disabled]="ocupado() || !nuevoTelefono().trim()" (click)="agregarTelefono(c)">Agregar</button>
          </div>
        }

        <section class="bloque" data-testid="promociones">
          <h3>Promociones</h3>
          @if (c.comunicaciones.vigente) {
            <p>Autorizó recibir promociones por <strong>{{ medios(c.comunicaciones.medios) }}</strong> desde el {{ c.comunicaciones.desde | date: 'dd/MM/yyyy' }}.</p>
            <button type="button" class="btn small danger" [disabled]="ocupado()" (click)="revocar(c)">Registrar que ya no quiere recibirlas</button>
          } @else {
            <p>{{ c.comunicaciones.estado === 'REVOCADO' ? 'Retiró su autorización: no se le envían promociones.' : 'No autorizó promociones: no se le envían.' }}</p>
            @if (c.activo && !c.fusionadoEnId) {
              <p class="nota">Solo si el comprador lo pide o lo acepta al preguntarle. Nunca se marca por defecto.</p>
              <div class="medios">
                @for (m of todosLosMedios; track m) {
                  <label><input type="checkbox" [checked]="medioElegido(m)" (change)="alternarMedio(m)"> {{ etiquetaMedio(m) }}</label>
                }
              </div>
              <button type="button" class="btn small" [disabled]="ocupado() || mediosElegidos().length === 0" (click)="otorgar(c)">Registrar su autorización</button>
            }
          }
        </section>

        @if (data.esAdmin && !c.fusionadoEnId) {
          <section class="bloque">
            <h3>Mayorista</h3>
            <p>{{ c.mayorista ? 'Habilitado para comprar al precio MAYORISTA.' : 'No habilitado: compra a precio PÚBLICO.' }}</p>
            <div class="fila-accion">
              <input type="text" [value]="motivoMayorista()" (input)="motivoMayorista.set($any($event.target).value)" placeholder="Motivo (obligatorio)" aria-label="Motivo del cambio de mayorista">
              <button type="button" class="btn small" [disabled]="ocupado() || !motivoMayorista().trim()" (click)="cambiarMayorista(c)">{{ c.mayorista ? 'Quitar mayorista' : 'Habilitar mayorista' }}</button>
            </div>
          </section>
        }

        @if (historial(); as h) {
          <section class="bloque" data-testid="historial">
            <h3>Historial</h3>
            <div class="indicadores">
              <div><span class="cifra">{{ h.compras.totalCompras }}</span> compras (S/ {{ h.compras.montoTotal | number: '1.2-2' }})</div>
              <div><span class="cifra">S/ {{ h.compras.montoAnio | number: '1.2-2' }}</span> en {{ h.compras.anio }} ({{ h.compras.comprasAnio }} compras)</div>
              <div>Última compra: {{ h.compras.ultimaCompra ? (h.compras.ultimaCompra | date: 'dd/MM/yyyy') : '—' }} · {{ h.compras.desdeReserva }} desde reserva</div>
            </div>
            <p class="nota">Solo cuentan las ventas asociadas a esta ficha; las ventas a «Cliente varios» no se atribuyen a nadie.</p>
            @if (compras().length) {
              <ul class="lista">
                @for (v of compras(); track v.ventaId) {
                  <li data-testid="compra">{{ v.fecha | date: 'dd/MM/yyyy' }} · {{ v.canal }} · S/ {{ v.total | number: '1.2-2' }}
                    @if (v.reservaCodigo) { · reserva {{ v.reservaCodigo }} }
                    <span class="meta">{{ lineas(v) }}</span></li>
                }
              </ul>
            }
            @if (h.reservas.length) {
              <h4>Reservas</h4>
              <ul class="lista">
                @for (r of h.reservas; track r.id) { <li>{{ r.codigo }} · {{ r.estado }} · retiro {{ r.fechaRetiro | date: 'dd/MM/yyyy' }}</li> }
              </ul>
            }
          </section>
        }

        <details class="bloque">
          <summary>Constancia de autorizaciones</summary>
          <ul class="lista">
            @for (k of consentimientos(); track $index) {
              <li data-testid="consentimiento">{{ k.registradoEn | date: 'dd/MM/yyyy HH:mm' }} · {{ k.finalidad === 'REGISTRO_CLIENTE' ? 'Registro' : 'Promociones' }}:
                {{ k.estado === 'OTORGADO' ? 'autorizó' : 'retiró su autorización' }}{{ k.medios.length ? ' (' + medios(k.medios) + ')' : '' }}
                · {{ forma(k.forma) }} · aviso {{ k.avisoVersion }}{{ k.avisoCompleto ? '' : ' (incompleto)' }}{{ k.registradoPor ? ' · ' + k.registradoPor : '' }}</li>
            }
          </ul>
        </details>

        @if (data.esAdmin && !c.fusionadoEnId) {
          <details class="bloque">
            <summary>Fusionar con otra ficha (duplicada)</summary>
            <p class="nota">Solo si confirmaste que es la misma persona. Las compras y teléfonos de ESTA ficha pasan a la elegida; esta queda desactivada.
              Las autorizaciones no se transfieren.</p>
            <div class="fila-accion">
              <input type="search" [value]="busquedaFusion()" (input)="busquedaFusion.set($any($event.target).value)" placeholder="Nombre o teléfono de la otra ficha" aria-label="Buscar la ficha destino">
              <button type="button" class="btn small" (click)="buscarDestino()">Buscar</button>
            </div>
            @for (d of destinos(); track d.id) {
              <label class="destino"><input type="radio" name="destino" [checked]="destino()?.id === d.id" (change)="destino.set(d)"> {{ d.nombre }} {{ d.telefono ?? '' }}</label>
            }
            @if (destino()) {
              <div class="fila-accion">
                <input type="text" [value]="motivoFusion()" (input)="motivoFusion.set($any($event.target).value)" placeholder="Motivo (obligatorio)" aria-label="Motivo de la fusión">
                <button type="button" class="btn small danger" [disabled]="ocupado() || !motivoFusion().trim()" (click)="fusionar(c)">Fusionar en {{ destino()!.nombre }}</button>
              </div>
            }
          </details>
        }
        @if (errorAccion()) { <p class="server-error" role="alert">{{ errorAccion() }}</p> }
      }
    </div>
    <div class="dialog-foot"><button type="button" class="btn" (click)="dialogRef.close(cambios)">Cerrar</button></div>
  `,
  styles: `
    :host { display: block; width: min(38rem, 100%); background: var(--color-surface); border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 92vh; overflow: auto; }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-4) var(--space-6); font-size: var(--font-size-sm); }
    .datos { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2) var(--space-4); margin: 0 0 var(--space-3); }
    dt { color: var(--color-text-muted); font-size: 0.75rem; }
    dd { margin: 0.15rem 0 0; font-weight: 600; overflow-wrap: anywhere; }
    .bloque { border-top: 1px solid var(--color-border); padding-top: var(--space-3); margin-top: var(--space-3); }
    .bloque h3 { font-size: var(--font-size-sm); margin: 0 0 var(--space-2); }
    .bloque summary { cursor: pointer; font-weight: 600; }
    .fila-accion { display: flex; gap: var(--space-2); margin: var(--space-2) 0; }
    .fila-accion input { flex: 1; }
    .medios { display: flex; gap: var(--space-3); flex-wrap: wrap; margin: var(--space-2) 0; }
    .indicadores { display: grid; gap: var(--space-1); }
    .cifra { font-weight: 800; }
    .lista { list-style: none; padding: 0; margin: var(--space-2) 0; }
    .lista li { padding: var(--space-1) 0; border-bottom: 1px solid var(--color-border); }
    .meta { display: block; color: var(--color-text-muted); font-size: 0.75rem; }
    .nota { color: var(--color-text-muted); font-size: 0.75rem; }
    .aviso { background: var(--color-warning-bg); color: var(--color-warning); border-radius: var(--radius-control); padding: var(--space-2); }
    .destino { display: block; margin: var(--space-1) 0; }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); }
    .dialog-foot { display: flex; justify-content: flex-end; padding: 0 var(--space-6) var(--space-6); }
    @media (max-width: 480px) { .datos { grid-template-columns: 1fr; } }
  `
})
export class ClienteDetalleDialog {
  protected readonly dialogRef = inject(DialogRef<boolean>);
  protected readonly data = inject<ClienteDetalleDialogData>(DIALOG_DATA);
  private readonly api = inject(ClientesApi);
  private readonly toast = inject(ToastService);

  protected readonly todosLosMedios = MEDIOS_COMERCIALES;
  protected readonly cliente = signal<ClienteResponse | null>(null);
  protected readonly historial = signal<HistorialClienteResponse | null>(null);
  protected readonly compras = signal<CompraResponse[]>([]);
  protected readonly consentimientos = signal<ConsentimientoResponse[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly nuevoTelefono = signal('');
  protected readonly motivoMayorista = signal('');
  protected readonly mediosElegidos = signal<MedioComercial[]>([]);
  protected readonly busquedaFusion = signal('');
  protected readonly destinos = signal<CompradorSugerencia[]>([]);
  protected readonly destino = signal<CompradorSugerencia | null>(null);
  protected readonly motivoFusion = signal('');
  protected cambios = false;

  constructor() {
    this.cargar();
  }

  protected forma(f: FormaAutorizacion): string {
    return ETIQUETAS_FORMA[f] ?? f;
  }

  protected etiquetaMedio(m: MedioComercial): string {
    return ETIQUETAS_MEDIO[m];
  }

  protected medios(ms: MedioComercial[]): string {
    return ms.map((m) => ETIQUETAS_MEDIO[m] ?? m).join(', ');
  }

  protected lineas(v: CompraResponse): string {
    return v.lineas.map((l) => `${l.cantidad} × ${l.producto} ${l.presentacion}`).join(' · ');
  }

  protected medioElegido(m: MedioComercial): boolean {
    return this.mediosElegidos().includes(m);
  }

  protected alternarMedio(m: MedioComercial): void {
    this.mediosElegidos.update((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m]));
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.obtener(this.data.id).subscribe({
      next: (c) => {
        this.cliente.set(c);
        this.cargando.set(false);
        this.api.historial(c.id).subscribe({ next: (h) => this.historial.set(h), error: () => undefined });
        this.api.compras(c.id, 0, 10).subscribe({ next: (p) => this.compras.set(p.contenido), error: () => undefined });
        this.api.consentimientos(c.id).subscribe({ next: (k) => this.consentimientos.set(k), error: () => undefined });
      },
      error: (e) => {
        this.error.set(mapHttpError(e));
        this.cargando.set(false);
      }
    });
  }

  private aplicar(c: ClienteResponse, mensaje: string): void {
    this.cliente.set(c);
    this.ocupado.set(false);
    this.cambios = true;
    this.toast.exito(mensaje);
    this.api.consentimientos(c.id).subscribe({ next: (k) => this.consentimientos.set(k), error: () => undefined });
  }

  private fallar(e: unknown): void {
    this.ocupado.set(false);
    this.errorAccion.set(mapHttpError(e).mensaje);
  }

  protected agregarTelefono(c: ClienteResponse): void {
    this.ocupado.set(true);
    this.errorAccion.set(null);
    this.api.agregarTelefono(c.id, this.nuevoTelefono()).subscribe({
      next: (r) => { this.nuevoTelefono.set(''); this.aplicar(r, 'Teléfono agregado.'); },
      error: (e) => this.fallar(e)
    });
  }

  protected otorgar(c: ClienteResponse): void {
    this.ocupado.set(true);
    this.errorAccion.set(null);
    this.api.avisos().subscribe({
      next: (aviso) => this.api.comunicaciones(c.id, { otorgada: true, medios: this.mediosElegidos(), forma: 'VERBAL_PRESENCIAL', avisoVersion: aviso.version })
        .subscribe({ next: (r) => { this.mediosElegidos.set([]); this.aplicar(r, 'Autorización de promociones registrada.'); }, error: (e) => this.fallar(e) }),
      error: (e) => this.fallar(e)
    });
  }

  /** Revocar es tan simple como autorizar: sin justificación, rige desde ahora. */
  protected revocar(c: ClienteResponse): void {
    this.ocupado.set(true);
    this.errorAccion.set(null);
    this.api.comunicaciones(c.id, { otorgada: false, forma: 'VERBAL_PRESENCIAL' }).subscribe({
      next: (r) => this.aplicar(r, 'Listo: ya no se le enviarán promociones.'),
      error: (e) => this.fallar(e)
    });
  }

  protected cambiarMayorista(c: ClienteResponse): void {
    this.ocupado.set(true);
    this.errorAccion.set(null);
    this.api.cambiarMayorista(c.id, !c.mayorista, this.motivoMayorista().trim()).subscribe({
      next: (r) => { this.motivoMayorista.set(''); this.aplicar(r, r.mayorista ? 'Habilitado como mayorista.' : 'Ya no es mayorista.'); },
      error: (e) => this.fallar(e)
    });
  }

  protected buscarDestino(): void {
    const texto = this.busquedaFusion().trim();
    if (texto.length < 3) return;
    this.api.sugerencias(criterioDeBusqueda(texto)).subscribe({
      next: (r) => this.destinos.set(r.filter((s) => s.tipo === 'CLIENTE' && s.id !== this.data.id)),
      error: (e) => this.errorAccion.set(mapHttpError(e).mensaje)
    });
  }

  protected fusionar(c: ClienteResponse): void {
    const d = this.destino();
    if (!d) return;
    this.ocupado.set(true);
    this.errorAccion.set(null);
    this.api.fusionar(c.id, d.id, this.motivoFusion().trim()).subscribe({
      next: (f) => {
        this.ocupado.set(false);
        this.cambios = true;
        this.toast.exito(`Fusionada en ${d.nombre}: ${f.ventasMovidas} compras y ${f.telefonosAgregados} teléfonos pasaron a esa ficha.`);
        this.cargar();
      },
      error: (e) => this.fallar(e)
    });
  }
}
