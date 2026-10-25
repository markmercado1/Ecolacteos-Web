import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { TAMANOS_PAGINA, TAMANO_PAGINA_POR_DEFECTO, paginaCorregida } from '../../../../shared/util/paginacion';
import { ClienteResponse } from '../../data-access/cliente.models';
import { ClientesApi } from '../../data-access/clientes.api';
import { ClienteDetalleDialog } from '../../ui/cliente-detalle-dialog/cliente-detalle-dialog';
import { CompradorSeleccion, RegistroClienteDialog } from '../../ui/registro-cliente-dialog/registro-cliente-dialog';

type Filtro = 'TODOS' | 'MAYORISTAS' | 'CON_PROMOCIONES' | 'INACTIVOS';

/**
 * Fase H: padrón VOLUNTARIO de clientes (ADMIN y VENTAS). Solo están quienes aceptaron registrarse; los proveedores que compran no
 * aparecen aquí (se usan sus fichas de proveedor). VENTAS ve teléfonos y documentos enmascarados.
 */
@Component({
  selector: 'app-clientes-page',
  imports: [DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">COMERCIAL</div>
        <h1>Clientes</h1>
        <p>Compradores que <strong>aceptaron registrarse</strong>. Registrarse es voluntario: quien no quiere compra igual como «Cliente varios».
          Los proveedores que compran se identifican con su ficha de proveedor.</p>
      </div>
      <div class="heading-actions">
        <button type="button" class="btn primary" (click)="registrar()">Registrar cliente</button>
      </div>
    </div>

    <ui-data-table
      [columnas]="columnas"
      [filas]="clientes()"
      [cargando]="cargando()"
      [error]="error()"
      mensajeVacio="No hay clientes que coincidan."
      titulo="Padrón de clientes"
      subtitulo="Los más recientes primero."
      [buscable]="true"
      placeholderBusqueda="Buscar por nombre, teléfono, DNI o RUC"
      etiquetaBusqueda="Buscar cliente por nombre, teléfono, DNI o RUC"
      [pagina]="pagina()"
      [totalPaginas]="totalPaginas()"
      [totalElementos]="totalElementos()"
      [tamano]="tamano()"
      [tamanos]="tamanos"
      unidad="clientes"
      (buscar)="buscar($event)"
      (cambiarPagina)="cambiarPagina($event)"
      (cambiarTamano)="cambiarTamano($event)"
      (reintentar)="cargar()"
    >
      <div toolbar>
        <select [value]="filtro()" (change)="cambiarFiltro($any($event.target).value)" aria-label="Filtrar clientes">
          <option value="TODOS">Activos</option>
          <option value="MAYORISTAS">Mayoristas</option>
          <option value="CON_PROMOCIONES">Con autorización de promociones</option>
          <option value="INACTIVOS">Desactivados</option>
        </select>
      </div>
      <ng-template #celda let-fila let-columna="columna">
        @switch (columna) {
          @case ('nombre') {
            <strong>{{ fila.nombre }}</strong>
            @if (fila.mayorista) { <span class="badge">Mayorista</span> }
            @if (fila.tipoPersona === 'EMPRESA') { <span class="badge gray">Empresa</span> }
          }
          @case ('telefono') { {{ fila.telefonos[0] ?? '—' }}{{ fila.telefonos.length > 1 ? ' (+' + (fila.telefonos.length - 1) + ')' : '' }} }
          @case ('documento') { {{ fila.ruc ? 'RUC ' + fila.ruc : (fila.dni ? 'DNI ' + fila.dni : '—') }} }
          @case ('promociones') { {{ fila.comunicaciones.vigente ? 'Sí (' + fila.comunicaciones.medios.join(', ') + ')' : 'No' }} }
          @case ('acciones') { <button type="button" class="row-link" (click)="abrir(fila)">Ver ficha</button> }
          @default { {{ fila[columna] ?? '—' }} }
        }
      </ng-template>
    </ui-data-table>
  `,
  styles: `.badge { margin-left: var(--space-2); }`
})
export class ClientesPage {
  private readonly api = inject(ClientesApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  protected readonly esAdmin = computed(() => this.auth.usuario()?.rolNombre === 'ADMIN');
  protected readonly clientes = signal<ClienteResponse[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly pagina = signal(0);
  protected readonly tamano = signal(TAMANO_PAGINA_POR_DEFECTO);
  protected readonly tamanos = TAMANOS_PAGINA;
  protected readonly totalPaginas = signal(0);
  protected readonly totalElementos = signal(0);
  protected readonly filtro = signal<Filtro>('TODOS');
  private readonly busqueda = signal('');
  private peticion?: Subscription;

  protected readonly columnas: ColumnaTabla[] = [
    { clave: 'nombre', etiqueta: 'Cliente' },
    { clave: 'telefono', etiqueta: 'Teléfono' },
    { clave: 'documento', etiqueta: 'DNI / RUC' },
    { clave: 'promociones', etiqueta: 'Promociones' },
    { clave: 'acciones', etiqueta: '' }
  ];

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.peticion?.unsubscribe();
    this.cargando.set(true);
    this.error.set(null);
    const f = this.filtro();
    this.peticion = this.api.listar({
      busqueda: this.busqueda() || undefined,
      activo: f !== 'INACTIVOS',
      mayorista: f === 'MAYORISTAS' ? true : undefined,
      conComunicaciones: f === 'CON_PROMOCIONES' ? true : undefined,
      page: this.pagina(),
      size: this.tamano()
    }).subscribe({
      next: (r) => {
        const corregida = paginaCorregida(r);
        if (corregida !== null) {
          this.pagina.set(corregida);
          this.cargar();
          return;
        }
        this.clientes.set(r.contenido);
        this.totalPaginas.set(r.totalPaginas);
        this.totalElementos.set(r.totalElementos);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mapHttpError(e));
        this.cargando.set(false);
      }
    });
  }

  protected buscar(texto: string): void {
    this.busqueda.set(texto);
    this.pagina.set(0);
    this.cargar();
  }

  protected cambiarFiltro(f: Filtro): void {
    this.filtro.set(f);
    this.pagina.set(0);
    this.cargar();
  }

  protected cambiarPagina(p: number): void {
    if (p < 0 || p >= this.totalPaginas()) return;
    this.pagina.set(p);
    this.cargar();
  }

  protected cambiarTamano(t: number): void {
    this.tamano.set(t);
    this.pagina.set(0);
    this.cargar();
  }

  protected registrar(): void {
    const ref = this.dialog.open<CompradorSeleccion | undefined>(RegistroClienteDialog, { ariaLabel: 'Registrar como cliente', data: {} });
    ref.closed.subscribe((c) => {
      if (!c) return;
      this.toast.exito(c.tipo === 'CLIENTE' ? `Cliente «${c.nombre}» registrado o elegido.` : `${c.nombre} ya es proveedor: usa su ficha de proveedor.`);
      this.cargar();
    });
  }

  protected abrir(c: ClienteResponse): void {
    const ref = this.dialog.open<boolean>(ClienteDetalleDialog, { ariaLabel: `Ficha de ${c.nombre}`, data: { id: c.id, esAdmin: this.esAdmin() } });
    ref.closed.subscribe((cambio) => {
      if (cambio) this.cargar();
    });
  }
}
