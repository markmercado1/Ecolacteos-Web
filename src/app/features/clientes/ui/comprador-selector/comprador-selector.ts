import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { CompradorSugerencia, criterioDeBusqueda, etiquetaCoincidencia } from '../../data-access/cliente.models';
import { ClientesApi } from '../../data-access/clientes.api';
import { CompradorSeleccion, RegistroClienteDialog, RegistroClienteDialogData } from '../registro-cliente-dialog/registro-cliente-dialog';

/**
 * Fase H: elegir quién compra. Busca fichas de cliente y de proveedor (por nombre, teléfono, DNI o RUC) y las SUGIERE: el trabajador
 * confirma con el comprador y elige. También permite registrar un cliente nuevo (voluntario) o seguir como «Cliente varios».
 */
@Component({
  selector: 'app-comprador-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="selector">
      <div class="buscador">
        <input type="search" [value]="texto()" (input)="texto.set($any($event.target).value)" (keydown.enter)="$event.preventDefault(); buscar()"
               placeholder="Nombre, teléfono, DNI o RUC del comprador" aria-label="Buscar comprador por nombre, teléfono, DNI o RUC">
        <button type="button" class="btn small" (click)="buscar()" [disabled]="buscando()">{{ buscando() ? 'Buscando…' : 'Buscar' }}</button>
      </div>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      @if (buscado()) {
        @if (resultados().length === 0) {
          <p class="hint" data-testid="sin-coincidencias">No hay fichas con esos datos.</p>
        } @else {
          <ul class="resultados">
            @for (r of resultados(); track r.tipo + r.id) {
              <li data-testid="sugerencia">
                <span class="info">
                  <strong>{{ r.nombre }}</strong>
                  <span class="badge" [class.gray]="r.tipo === 'CLIENTE'">{{ r.tipo === 'PROVEEDOR' ? 'Proveedor' : 'Cliente' }}</span>
                  @if (r.mayorista) { <span class="badge">Mayorista</span> }
                  @if (!r.activo) { <span class="badge gray">Desactivada</span> }
                  <span class="meta">{{ r.telefono ?? '' }} {{ r.documento ? '· ' + r.documento : '' }} · {{ coincidencia(r) }}</span>
                </span>
                <button type="button" class="btn small" [disabled]="!r.activo" (click)="elegir(r)">Es esta persona</button>
              </li>
            }
          </ul>
        }
      }
      <div class="acciones">
        @if (permitirRegistro()) { <button type="button" class="btn small" (click)="registrar()">Registrar cliente nuevo</button> }
        @if (permitirVarios()) { <button type="button" class="btn small" (click)="elegido.emit(null)">Cliente varios</button> }
      </div>
    </div>
  `,
  styles: `
    .buscador { display: flex; gap: var(--space-2); }
    .buscador input { flex: 1; }
    .resultados { list-style: none; padding: 0; margin: var(--space-2) 0; max-height: 14rem; overflow: auto; }
    .resultados li { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border); }
    .info { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-2); align-items: center; }
    .meta { width: 100%; font-size: 0.75rem; color: var(--color-text-muted); }
    .acciones { display: flex; gap: var(--space-2); margin-top: var(--space-2); flex-wrap: wrap; }
    .hint { font-size: var(--font-size-sm); color: var(--color-text-muted); margin: var(--space-2) 0; }
    .error { color: var(--color-danger); font-size: var(--font-size-sm); }
  `
})
export class CompradorSelectorComponent implements OnInit {
  private readonly api = inject(ClientesApi);
  private readonly dialog = inject(Dialog);

  /** Texto inicial (por ejemplo, el teléfono de la reserva). */
  readonly inicial = input<string>('');
  /** Datos para prellenar el registro de un cliente nuevo. */
  readonly datosRegistro = input<RegistroClienteDialogData | null>(null);
  readonly permitirRegistro = input(true);
  readonly permitirVarios = input(true);
  readonly elegido = output<CompradorSeleccion | null>();

  protected readonly texto = signal('');
  protected readonly resultados = signal<CompradorSugerencia[]>([]);
  protected readonly buscando = signal(false);
  protected readonly buscado = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    if (this.inicial()) {
      this.texto.set(this.inicial());
      this.buscar();
    }
  }

  protected coincidencia(r: CompradorSugerencia): string {
    return etiquetaCoincidencia(r.coincidencia);
  }

  protected buscar(): void {
    const texto = this.texto().trim();
    if (texto.length < 3) {
      this.error.set('Escribe al menos 3 caracteres.');
      return;
    }
    this.error.set(null);
    this.buscando.set(true);
    this.api.sugerencias(criterioDeBusqueda(texto)).subscribe({
      next: (r) => {
        this.resultados.set(r);
        this.buscando.set(false);
        this.buscado.set(true);
      },
      error: (e) => {
        this.error.set(mapHttpError(e).mensaje);
        this.buscando.set(false);
      }
    });
  }

  protected elegir(r: CompradorSugerencia): void {
    this.elegido.emit({ tipo: r.tipo, id: r.id, nombre: r.nombre, mayorista: r.mayorista, canalHabitual: r.canalHabitual });
  }

  protected registrar(): void {
    const criterio = criterioDeBusqueda(this.texto());
    const datos: RegistroClienteDialogData = this.datosRegistro() ?? {
      nombre: criterio.nombre ?? null,
      telefono: criterio.telefono ?? null
    };
    const ref = this.dialog.open<CompradorSeleccion | undefined>(RegistroClienteDialog, { ariaLabel: 'Registrar como cliente', data: datos });
    ref.closed.subscribe((c) => {
      if (c) this.elegido.emit(c);
    });
  }
}
