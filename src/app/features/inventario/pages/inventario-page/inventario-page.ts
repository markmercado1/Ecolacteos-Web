import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ListaLocal } from '../../../../shared/util/lista-local';
import { TAMANOS_PAGINA, TAMANO_PAGINA_POR_DEFECTO } from '../../../../shared/util/paginacion';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Dialog } from '@angular/cdk/dialog';
import { FamiliaResponse } from '../../../catalogos/data-access/familia.models';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { AuthService } from '../../../../core/auth/auth.service';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { InventarioApi } from '../../data-access/inventario.api';
import { AjusteInventarioResponse, FilaStockResponse } from '../../data-access/inventario.models';
import { KardexApi } from '../../data-access/kardex.api';
import { MovimientoInsumoResponse } from '../../data-access/kardex.models';
import { InsumoResponse } from '../../../catalogos/data-access/insumo.models';
import { AjustarStockDialog } from '../../ui/ajustar-stock-dialog/ajustar-stock-dialog';
import { HistorialAjustesDialog } from '../../ui/historial-ajustes-dialog/historial-ajustes-dialog';
import { KardexDialog } from '../../ui/kardex-dialog/kardex-dialog';
import { LotesPresentacionDialog } from '../../ui/lotes-presentacion-dialog/lotes-presentacion-dialog';
import { KardexVistaComponent } from '../../ui/kardex-vista/kardex-vista';
import { MovimientoInsumoDialog } from '../../ui/movimiento-insumo-dialog/movimiento-insumo-dialog';
import { ExportarExcelComponent } from '../../../../shared/ui/exportar-excel/exportar-excel';

/** Producto terminado: PRODUCCION, VENTAS y ADMIN. Insumos y leche: solo PRODUCCION y ADMIN (V19). */
type Seccion = 'productos' | 'insumos' | 'leche';

@Component({
  selector: 'app-inventario-page',
  imports: [ExportarExcelComponent, DataTableComponent, DecimalPipe, KardexVistaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inventario-page.html',
  styleUrl: './inventario-page.css'
})
export class InventarioPage {
  private readonly inventarioApi = inject(InventarioApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(Dialog);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private consulta?: Subscription;
  protected readonly esAdmin = computed(() => this.auth.usuario()?.rolNombre === 'ADMIN');
  /** VENTAS solo consulta producto terminado: no ve insumos ni leche. */
  protected readonly veMateriasPrimas = computed(() => {
    const rol = this.auth.usuario()?.rolNombre;
    return rol === 'ADMIN' || rol === 'PRODUCCION';
  });
  private readonly kardexApi = inject(KardexApi);
  private readonly route = inject(ActivatedRoute, { optional: true });
  protected readonly seccion = signal<Seccion>('productos');

  protected readonly insumos = signal<InsumoResponse[]>([]);
  /** Insumos: el servidor entrega la lista completa (pocos y alfabéticos); se busca y pagina en el cliente. */
  protected readonly listaInsumos = new ListaLocal(this.insumos, {
    campos: (i) => [i.nombre, i.unidadMedida],
    id: (i) => i.id,
    destroyRef: this.destroyRef
  });
  protected readonly tamanos = TAMANOS_PAGINA;
  protected readonly cargandoInsumos = signal(false);
  protected readonly errorInsumos = signal<AppError | null>(null);
  private insumosCargados = false;
  protected readonly columnasInsumos = computed<ColumnaTabla[]>(() => [
    { clave: 'nombre', etiqueta: 'Insumo' },
    { clave: 'stock', etiqueta: 'Stock', alinearFin: true },
    { clave: 'acciones', etiqueta: '' }
  ]);
  protected readonly identificarInsumo = (fila: InsumoResponse) => fila.id;

  protected readonly familias = signal<FamiliaResponse[]>([]);
  protected readonly familiaId = signal('');
  protected readonly cargandoFamilias = signal(false);
  protected readonly errorFamilias = signal<AppError | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly stock = signal<FilaStockResponse[]>([]);
  protected readonly pagina = signal(0);
  protected readonly tamano = signal(TAMANO_PAGINA_POR_DEFECTO);
  /** Texto del buscador estándar (producto o presentación): se envía al servidor y busca entre todo el inventario. */
  private readonly busquedaAplicada = signal('');
  protected readonly total = signal(0);
  protected readonly paginas = signal(0);
  protected readonly identificarFila = (fila: FilaStockResponse) => fila.presentacionId;
  protected readonly columnas = computed<ColumnaTabla[]>(() => [
    { clave: 'familiaNombre', etiqueta: 'Familia' },
    { clave: 'productoNombre', etiqueta: 'Producto' },
    { clave: 'presentacionNombre', etiqueta: 'Presentación' },
    { clave: 'stock', etiqueta: 'Existencias', alinearFin: true },
    { clave: 'acciones', etiqueta: '' }
  ]);

  /** Familia y búsqueda vigentes: el Excel trae todas las presentaciones que las cumplen, no solo la página visible. */
  protected readonly filtroExportacionStock = computed(() => ({ familiaId: this.familiaId() || undefined, busqueda: this.busquedaAplicada() || undefined }));

  /** Búsqueda vigente de la tabla de insumos. */
  protected readonly filtroExportacionInsumos = computed(() => ({ busqueda: this.listaInsumos.busqueda() || undefined }));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.consulta?.unsubscribe());
    this.cargarFamilias();
    this.cargar();
    // ?seccion=insumos|leche permite llegar directo (p. ej. desde Producción para reponer un insumo).
    const pedida = this.route?.snapshot.queryParamMap.get('seccion');
    if ((pedida === 'insumos' || pedida === 'leche') && this.veMateriasPrimas()) this.cambiarSeccion(pedida);
  }

  protected cambiarSeccion(seccion: Seccion): void {
    this.seccion.set(seccion);
    if (seccion === 'insumos' && !this.insumosCargados) this.cargarInsumos();
  }

  protected cargarInsumos(): void {
    this.cargandoInsumos.set(true);
    this.errorInsumos.set(null);
    this.kardexApi
      .listarInsumos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (insumos) => {
          this.insumos.set(insumos);
          this.insumosCargados = true;
          this.cargandoInsumos.set(false);
        },
        error: (error) => {
          this.errorInsumos.set(mapHttpError(error));
          this.cargandoInsumos.set(false);
        }
      });
  }

  protected verKardexPresentacion(fila: FilaStockResponse): void {
    this.dialog.open(KardexDialog, {
      ariaLabel: `Kardex de ${fila.productoNombre} ${fila.presentacionNombre}`,
      data: {
        tipo: 'PRESENTACION',
        itemId: fila.presentacionId,
        titulo: `${fila.productoNombre} · ${fila.presentacionNombre}`,
        subtitulo: `Producto terminado, en ${fila.unidadConteo}`
      }
    });
  }

  protected verKardexInsumo(insumo: InsumoResponse): void {
    this.dialog.open(KardexDialog, {
      ariaLabel: `Kardex de ${insumo.nombre}`,
      data: { tipo: 'INSUMO', itemId: insumo.id, titulo: insumo.nombre, subtitulo: `Insumo, en ${insumo.unidadMedida}` }
    });
  }

  protected movimientoInsumo(insumo: InsumoResponse, modo: 'INGRESO' | 'AJUSTE'): void {
    const ref = this.dialog.open<MovimientoInsumoResponse | undefined>(MovimientoInsumoDialog, {
      ariaLabel: `${modo === 'INGRESO' ? 'Registrar ingreso' : 'Ajustar'} ${insumo.nombre}`,
      data: { modo, insumo }
    });
    ref.closed.subscribe((m) => {
      if (!m) return;
      this.toast.exito(
        `${m.tipoMovimiento === 'INGRESO' ? 'Ingreso' : 'Ajuste'} registrado: ${m.insumoNombre} pasó de ` +
          `${m.saldoAnterior} a ${m.saldoResultante} ${m.unidadMedida}.`
      );
      this.cargarInsumos();
    });
  }

  protected cargarFamilias(): void {
    if (this.cargandoFamilias()) return;
    this.cargandoFamilias.set(true);
    this.errorFamilias.set(null);
    this.inventarioApi
      .listarFamilias()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (familias) => {
          this.familias.set(familias);
          this.cargandoFamilias.set(false);
        },
        error: (error) => {
          this.errorFamilias.set(mapHttpError(error));
          this.cargandoFamilias.set(false);
        }
      });
  }

  protected cambiarFamilia(familiaId: string): void {
    this.familiaId.set(familiaId);
    this.pagina.set(0);
    this.cargar();
  }

  protected cambiarPagina(pagina: number): void {
    if (pagina < 0 || pagina >= this.paginas()) return;
    this.pagina.set(pagina);
    this.cargar();
  }

  protected cambiarTamano(valor: number): void {
    this.tamano.set(valor);
    this.pagina.set(0);
    this.cargar();
  }

  protected buscar(texto: string): void {
    this.busquedaAplicada.set(texto);
    this.pagina.set(0);
    this.cargar();
  }

  protected cargar(): void {
    this.consulta?.unsubscribe();
    this.cargando.set(true);
    this.error.set(null);
    this.consulta = this.inventarioApi
      .listarStock({
        page: this.pagina(),
        size: this.tamano(),
        familiaId: this.familiaId() || undefined,
        busqueda: this.busquedaAplicada() || undefined
      })
      .subscribe({
        next: (resultado) => {
          if (resultado.totalPaginas > 0 && this.pagina() >= resultado.totalPaginas) {
            this.pagina.set(resultado.totalPaginas - 1);
            this.cargar();
            return;
          }
          this.stock.set(resultado.contenido);
          this.pagina.set(resultado.totalElementos === 0 ? 0 : resultado.paginaActual);
          this.tamano.set(resultado.tamanoPagina);
          this.total.set(resultado.totalElementos);
          this.paginas.set(resultado.totalPaginas);
          this.cargando.set(false);
        },
        error: (error) => {
          this.error.set(mapHttpError(error));
          this.cargando.set(false);
        }
      });
  }

  protected ajustarStock(fila: FilaStockResponse): void {
    const ref = this.dialog.open<AjusteInventarioResponse | undefined>(AjustarStockDialog, {
      ariaLabel: `Ajustar stock de ${fila.presentacionNombre}`,
      data: {
        presentacionId: fila.presentacionId,
        presentacionNombre: fila.presentacionNombre,
        productoNombre: fila.productoNombre,
        stockActual: fila.stock
      }
    });
    ref.closed.subscribe((ajuste) => {
      if (ajuste) {
        this.toast.exito(
          `Ajuste registrado: ${fila.presentacionNombre} pasó de ${ajuste.cantidadAnterior} a ${ajuste.cantidadCorregida}.`
        );
        this.cargar(); // conserva familia/página actuales
      }
    });
  }

  /** Fase 2: lotes y vencimientos de una presentación con control de vencimiento (ADMIN además puede regularizar). */
  protected verLotes(fila: FilaStockResponse): void {
    const ref = this.dialog.open<boolean>(LotesPresentacionDialog, {
      ariaLabel: `Lotes de ${fila.presentacionNombre}`,
      data: {
        presentacionId: fila.presentacionId,
        presentacionNombre: fila.presentacionNombre,
        productoNombre: fila.productoNombre,
        puedeRegularizar: this.esAdmin()
      }
    });
    ref.closed.subscribe((huboCambios) => {
      if (huboCambios) this.cargar(); // conserva familia/página actuales
    });
  }

  protected verAjustes(fila: FilaStockResponse): void {
    this.dialog.open(HistorialAjustesDialog, {
      ariaLabel: `Ajustes de ${fila.presentacionNombre}`,
      data: {
        presentacionId: fila.presentacionId,
        presentacionNombre: fila.presentacionNombre,
        productoNombre: fila.productoNombre
      }
    });
  }
}
