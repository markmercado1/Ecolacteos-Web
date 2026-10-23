import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { Observable, Subscription } from 'rxjs';
import { Acopio, AcopioPorJornada, AcopiosApi, FiltroAcopiosPaginado, TotalAcopioProveedor } from './acopios.api';
import { AcopioDetalle } from './acopio-detalle';
import { HistorialProveedorDialog } from './historial-proveedor-dialog';
import { UnidadesApi } from '../unidades/data-access/unidades.api';
import { UnidadResponse } from '../unidades/data-access/unidad.models';
import { ZonasApi } from '../catalogos/data-access/zonas.api';
import { ZonaResponse } from '../catalogos/data-access/zona.models';
import { AppError, mapHttpError } from '../../core/http/app-error';
import { BarChartComponent, BarraChart } from '../../shared/ui/chart/bar-chart';
import { ColumnaTabla, DataTableComponent } from '../../shared/ui/data-table/data-table';
import { ExportarExcelComponent } from '../../shared/ui/exportar-excel/exportar-excel';
import { fechaHoyLima } from '../../shared/util/fecha';
import { PaginaResponse } from '../../shared/models/pagina-response';
import { paginaCorregida, TAMANOS_PAGINA, TAMANO_PAGINA_POR_DEFECTO } from '../../shared/util/paginacion';

@Component({
  selector: 'app-acopios-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent, DatePipe, DecimalPipe, BarChartComponent, ExportarExcelComponent],
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">OPERACIÓN</div>
        <h1>Acopios</h1>
        <p>Entregas de leche registradas en campo. Consulta su fecha, ubicación y fotografía.</p>
      </div>
    </div>
    <div class="card filtros">
      <div class="field">
        <label for="fecha-acopios">Fecha de captura</label
        ><input
          id="fecha-acopios"
          type="date"
          [value]="fecha()"
          (change)="cambiarFecha($any($event.target).value)"
        />
      </div>
      <button class="btn" (click)="cambiarFecha(hoy())">Hoy</button>
      <div class="field">
        <label for="zona-acopios">Zona</label
        ><select
          id="zona-acopios"
          [value]="filtroZona()"
          (change)="cambiarFiltroZona($any($event.target).value)"
        >
          <option value="">Todas las zonas</option>
          @for (zona of zonas(); track zona.id) {
            <option [value]="zona.id">{{ zona.nombre }}</option>
          }
        </select>
      </div>
      <div class="field checkbox">
        <label
          ><input
            type="checkbox"
            [checked]="soloSinAnalisis()"
            (change)="cambiarSoloSinAnalisis($any($event.target).checked)"
          />
          Solo entregas sin análisis</label
        >
      </div>
      <button class="btn primary" [disabled]="cargando()" (click)="actualizar()">Actualizar</button>
    </div>
    <p>
      Solo se muestran acopios enviados al servidor. Los pendientes del móvil aparecerán después de
      sincronizarse. Sin marcar "Solo entregas sin análisis" se listan todas las entregas del filtro, no
      solo las ya analizadas.
    </p>
    @if (errorUnidades()) {
      <p role="alert">
        No se pudieron cargar las placas. Se muestran los identificadores de unidad.
        <button class="row-link" (click)="cargarUnidades()">Reintentar placas</button>
      </p>
    }
    @if (errorZonas()) {
      <p role="alert">
        No se pudieron cargar las zonas para filtrar.
        <button class="row-link" (click)="cargarZonas()">Reintentar zonas</button>
      </p>
    }

    <div class="tabs" role="tablist">
      <button type="button" class="tab" [class.active]="vista() === 'jornada'" (click)="cambiarVista('jornada')" role="tab">
        Por jornada
      </button>
      <button type="button" class="tab" [class.active]="vista() === 'entrega'" (click)="cambiarVista('entrega')" role="tab">
        Por entrega
      </button>
    </div>

    @if (vista() === 'jornada') {
      <ui-data-table
        titulo="Jornadas del día"
        [subtitulo]="fecha() + ' · una fila por recorrido; las entregas sin jornada activa aparecen sueltas'"
        [columnas]="columnasJornada"
        [filas]="filasJornada()"
        [cargando]="cargando()"
        [error]="error()"
        (reintentar)="cargar()"
        mensajeVacio="No hay acopios para esta fecha y búsqueda."
        [buscable]="true"
        placeholderBusqueda="Buscar por proveedor o placa"
        etiquetaBusqueda="Buscar acopios por proveedor o placa"
        [busquedaInicial]="busquedaAplicada()"
        [pagina]="pagina()"
        [totalPaginas]="totalPaginas()"
        [totalElementos]="totalElementos()"
        [tamano]="tamano()"
        [tamanos]="tamanos"
        unidad="jornadas"
        (buscar)="buscar($event)"
        (cambiarPagina)="cambiarPagina($event)"
        (cambiarTamano)="cambiarTamano($event)"
      >
        <div toolbar>
          <ui-exportar-excel recurso="acopios" [filtro]="filtroExportacion()" />
        </div>
        <ng-template #celda let-fila let-columna="columna">
          @switch (columna) {
            @case ('acopiador') {
              {{ fila.acopiadorNombre ?? '—' }}
            }
            @case ('fecha') {
              {{ fila.fecha | date: 'dd/MM/yyyy' }}
            }
            @case ('placa') {
              {{ fila.placa ?? '—' }}
            }
            @case ('cantidad') {
              {{ fila.cantidad }}
            }
            @case ('total') {
              {{ fila.totalLitros | number: '1.0-3' }} L
            }
            @case ('acciones') {
              <button class="row-link" (click)="verJornada(fila)">
                {{ fila.esJornada ? 'Ver jornada' : 'Ver detalle' }}
              </button>
            }
          }
        </ng-template>
      </ui-data-table>
    } @else {
      <ui-data-table
        titulo="Acopios del día"
        [subtitulo]="fecha() + ' · Hora local de captura'"
        [columnas]="columnas"
        [filas]="filasEntrega()"
        [cargando]="cargando()"
        [error]="error()"
        (reintentar)="cargar()"
        mensajeVacio="No hay acopios para esta fecha y búsqueda."
        [buscable]="true"
        placeholderBusqueda="Buscar por proveedor o placa"
        etiquetaBusqueda="Buscar acopios por proveedor o placa"
        [busquedaInicial]="busquedaAplicada()"
        [pagina]="pagina()"
        [totalPaginas]="totalPaginas()"
        [totalElementos]="totalElementos()"
        [tamano]="tamano()"
        [tamanos]="tamanos"
        unidad="entregas"
        (buscar)="buscar($event)"
        (cambiarPagina)="cambiarPagina($event)"
        (cambiarTamano)="cambiarTamano($event)"
      >
        <div toolbar>
          <ui-exportar-excel recurso="acopios" [filtro]="filtroExportacion()" />
        </div>
        <ng-template #celda let-r let-columna="columna">
          @switch (columna) {
            @case ('fechaHora') {
              {{ r.fechaHora | date: 'dd/MM/yyyy HH:mm:ss' }}
            }
            @case ('proveedorNombre') {
              <strong>{{ r.proveedorNombre }}</strong>
            }
            @case ('placa') {
              {{ placa(r.unidadId) }}
            }
            @case ('litros') {
              {{ r.litros | number: '1.0-3' }} L
            }
            @case ('gps') {
              {{ r.gpsLat !== null && r.gpsLng !== null ? 'Registrado' : 'Sin GPS' }}
            }
            @case ('foto') {
              {{ r.fotoUrl ? 'Con foto' : 'Sin foto' }}
            }
            @case ('acciones') {
              <button class="row-link" (click)="abrir(r)">Ver detalle</button>
              &nbsp;&nbsp;
              <button class="row-link" (click)="abrirHistorial(r)">Ver historial del proveedor</button>
            }
          }
        </ng-template>
      </ui-data-table>
    }

    <div class="card card-pad grafico-proveedor">
      <ui-bar-chart
        titulo="Acopio por proveedor"
        [subtitulo]="fecha() + (filtroZona() ? ' · ' + zonaSeleccionadaNombre() : ' · Todas las zonas') + ' · litros originales del filtro completo'"
        unidad="L"
        [datos]="datosPorProveedor()"
        [serieUnica]="true"
        [decimales]="3"
        mensajeVacio="No hay acopios para agregar por proveedor con este filtro."
      />
      @if (errorResumen()) {
        <p role="alert">
          No se pudo cargar el resumen por proveedor.
          <button class="row-link" (click)="cargarResumen()">Reintentar</button>
        </p>
      }
    </div>
  `,
  styles: `
    .filtros {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: var(--space-3);
      padding: var(--space-4);
    }
    .field {
      margin: 0;
    }
    .field.checkbox label {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--font-size-sm);
    }
    p {
      color: var(--color-text-muted);
    }
    .grafico-proveedor {
      margin-top: var(--space-4);
    }
  `,
})
export class AcopiosPage {
  private readonly api = inject(AcopiosApi);
  private readonly unidadesApi = inject(UnidadesApi);
  private readonly zonasApi = inject(ZonasApi);
  private readonly dialog = inject(Dialog);
  private readonly destroy = inject(DestroyRef);
  private peticion?: Subscription;
  private peticionResumen?: Subscription;
  protected readonly hoy = fechaHoyLima;
  protected readonly fecha = signal(fechaHoyLima());
  protected readonly filtroZona = signal('');
  protected readonly soloSinAnalisis = signal(false);
  /** Texto del buscador estándar (proveedor o placa) que se envía al servidor: busca entre TODOS los acopios del día. */
  protected readonly busquedaAplicada = signal('');
  /** Filtros y búsqueda vigentes: el Excel trae una fila por entrega de todo el filtro, no solo la página visible. */
  protected readonly filtroExportacion = computed(() => ({
    fecha: this.fecha(),
    zonaId: this.filtroZona() || undefined,
    sinAnalisis: this.soloSinAnalisis() || undefined,
    busqueda: this.busquedaAplicada() || undefined,
  }));
  protected readonly filasEntrega = signal<Acopio[]>([]);
  protected readonly filasJornada = signal<AcopioPorJornada[]>([]);
  protected readonly pagina = signal(0);
  protected readonly tamano = signal(TAMANO_PAGINA_POR_DEFECTO);
  protected readonly tamanos = TAMANOS_PAGINA;
  protected readonly totalElementos = signal(0);
  protected readonly totalPaginas = signal(0);
  protected readonly unidades = signal<UnidadResponse[]>([]);
  protected readonly errorUnidades = signal(false);
  protected readonly zonas = signal<ZonaResponse[]>([]);
  protected readonly errorZonas = signal(false);
  protected readonly cargando = signal(false);
  protected readonly error = signal<AppError | null>(null);
  protected readonly vista = signal<'jornada' | 'entrega'>('jornada');
  private readonly resumen = signal<TotalAcopioProveedor[]>([]);
  protected readonly errorResumen = signal(false);
  protected readonly columnas: ColumnaTabla[] = [
    { clave: 'fechaHora', etiqueta: 'Fecha y hora' },
    { clave: 'proveedorNombre', etiqueta: 'Proveedor' },
    { clave: 'placa', etiqueta: 'Placa' },
    { clave: 'litros', etiqueta: 'Litros', alinearFin: true },
    { clave: 'gps', etiqueta: 'Ubicación' },
    { clave: 'foto', etiqueta: 'Fotografía' },
    { clave: 'acciones', etiqueta: '' },
  ];
  protected readonly columnasJornada: ColumnaTabla[] = [
    { clave: 'acopiador', etiqueta: 'Acopiador' },
    { clave: 'fecha', etiqueta: 'Fecha' },
    { clave: 'placa', etiqueta: 'Placa' },
    { clave: 'cantidad', etiqueta: 'Acopios', alinearFin: true },
    { clave: 'total', etiqueta: 'Total', alinearFin: true },
    { clave: 'acciones', etiqueta: '' },
  ];
  protected readonly zonaSeleccionadaNombre = computed(
    () => this.zonas().find((z) => z.id === this.filtroZona())?.nombre ?? '',
  );
  /**
   * Totales del FILTRO COMPLETO (fecha/zona/sinAnalisis), agregados en el servidor
   * (GET /registros-acopio/resumen-por-proveedor): no dependen de la página visible ni del buscador de
   * texto, que solo afectan a las tablas. El servidor ya los entrega ordenados por litros descendente.
   */
  protected readonly datosPorProveedor = computed<BarraChart[]>(() =>
    this.resumen().map((p) => ({ etiqueta: p.proveedorNombre, valor: p.totalLitros })),
  );
  constructor() {
    this.cargarUnidades();
    this.cargarZonas();
    this.actualizar();
  }
  protected placa(id: string) {
    return this.unidades().find((u) => u.id === id)?.placa ?? id;
  }
  protected cambiarFecha(fecha: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return;
    this.fecha.set(fecha);
    this.reiniciarYActualizar();
  }
  protected cambiarFiltroZona(zonaId: string) {
    this.filtroZona.set(zonaId);
    this.reiniciarYActualizar();
  }
  protected cambiarSoloSinAnalisis(activo: boolean) {
    this.soloSinAnalisis.set(activo);
    this.reiniciarYActualizar();
  }
  /** Buscador estándar: reinicia a la página 0; cargar() cancela cualquier consulta anterior todavía en vuelo. */
  protected buscar(texto: string) {
    this.busquedaAplicada.set(texto);
    this.pagina.set(0);
    this.cargar();
  }
  /** Cada vista pagina cosas distintas (jornadas vs. entregas): al cambiar de vista se vuelve a la página 0. */
  protected cambiarVista(vista: 'jornada' | 'entrega') {
    if (this.vista() === vista) return;
    this.vista.set(vista);
    this.pagina.set(0);
    this.cargar();
  }
  protected cambiarPagina(pagina: number) {
    if (pagina < 0 || pagina >= this.totalPaginas()) return;
    this.pagina.set(pagina);
    this.cargar();
  }

  protected cambiarTamano(tamano: number) {
    this.tamano.set(tamano);
    this.pagina.set(0);
    this.cargar();
  }
  /** Tabla y gráfico: carga inicial, botón "Actualizar" y cambios de fecha/zona/análisis. */
  protected actualizar() {
    this.cargar();
    this.cargarResumen();
  }
  /** Solo la página visible de la vista activa. */
  protected cargar() {
    this.peticion?.unsubscribe();
    this.cargando.set(true);
    this.error.set(null);
    const filtro: FiltroAcopiosPaginado = {
      fecha: this.fecha(),
      zonaId: this.filtroZona() || undefined,
      sinAnalisis: this.soloSinAnalisis() || undefined,
      busqueda: this.busquedaAplicada() || undefined,
      page: this.pagina(),
      size: this.tamano(),
    };
    const vista = this.vista();
    const peticion: Observable<PaginaResponse<Acopio | AcopioPorJornada>> =
      vista === 'jornada' ? this.api.porJornada(filtro) : this.api.listarPaginado(filtro);
    this.peticion = peticion.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (respuesta) => {
        const corregida = paginaCorregida(respuesta);
        if (corregida !== null) {
          this.pagina.set(corregida);
          this.cargar();
          return;
        }
        if (vista === 'jornada') {
          this.filasJornada.set(respuesta.contenido as AcopioPorJornada[]);
        } else {
          this.filasEntrega.set(respuesta.contenido as Acopio[]);
        }
        this.totalElementos.set(respuesta.totalElementos);
        this.totalPaginas.set(respuesta.totalPaginas);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mapHttpError(e));
        this.cargando.set(false);
      },
    });
  }
  protected cargarResumen() {
    this.peticionResumen?.unsubscribe();
    this.errorResumen.set(false);
    this.resumen.set([]);
    this.peticionResumen = this.api
      .resumenPorProveedor({
        fecha: this.fecha(),
        zonaId: this.filtroZona() || undefined,
        sinAnalisis: this.soloSinAnalisis() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (r) => this.resumen.set(r), error: () => this.errorResumen.set(true) });
  }
  protected cargarUnidades() {
    this.errorUnidades.set(false);
    this.unidadesApi
      .listar()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (u) => this.unidades.set(u), error: () => this.errorUnidades.set(true) });
  }
  protected cargarZonas() {
    this.errorZonas.set(false);
    this.zonasApi
      .listarAdmin()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (z) => this.zonas.set(z), error: () => this.errorZonas.set(true) });
  }
  protected abrir(r: Acopio) {
    this.dialog.open(AcopioDetalle, {
      ariaLabel: 'Detalle del acopio',
      data: { id: r.id, placa: this.placa(r.unidadId) },
    });
  }
  protected abrirHistorial(r: Acopio) {
    this.dialog.open(HistorialProveedorDialog, {
      ariaLabel: `Historial de ${r.proveedorNombre}`,
      data: { proveedorId: r.proveedorId, proveedorNombre: r.proveedorNombre },
    });
  }
  /**
   * Reutiliza AcopioDetalle: entra por el primer acopio cronológico (de ahí saca el jornadaId para el
   * recorrido, mapa y fotos) y, si la fila es una jornada, le pasa `jornada` para que el encabezado
   * muestre el resumen de todo el recorrido (acopiador, total de litros) en vez de esa primera parada.
   * La agrupación, el primer acopio y el total los resuelve el servidor sobre todas las entregas del filtro.
   */
  protected verJornada(fila: AcopioPorJornada) {
    const placa = fila.placa ?? '—';
    this.dialog.open(AcopioDetalle, {
      ariaLabel: fila.esJornada ? `Detalle de la jornada de ${fila.acopiadorNombre ?? placa}` : 'Detalle del acopio',
      data: {
        id: fila.primerAcopioId,
        placa,
        jornada: fila.esJornada
          ? { acopiadorNombre: fila.acopiadorNombre, fecha: fila.fecha, cantidad: fila.cantidad, totalLitros: fila.totalLitros }
          : undefined,
      },
    });
  }
  private reiniciarYActualizar() {
    this.pagina.set(0);
    this.actualizar();
  }
}
