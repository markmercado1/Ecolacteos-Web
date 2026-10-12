import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { paginaCorregida } from '../../../../shared/util/paginacion';
import { FamiliaResponse } from '../../../catalogos/data-access/familia.models';
import { FamiliasApi } from '../../../catalogos/data-access/familias.api';
import { PresentacionResponse } from '../../../catalogos/data-access/producto.models';
import { FilaPrecioPresentacionResponse, PrecioQuesoResponse } from '../../data-access/precio-queso.models';
import { PrecioLitroResponse } from '../../data-access/precio.models';
import { PreciosQuesoApi } from '../../data-access/precios-queso.api';
import { PreciosApi } from '../../data-access/precios.api';
import { PrecioQuesoFormDialog } from '../../ui/precio-queso-form-dialog/precio-queso-form-dialog';
import { HistorialPrecioDialog } from '../../ui/historial-precio-dialog/historial-precio-dialog';
import { PrecioFormDialog } from '../../ui/precio-form-dialog/precio-form-dialog';

type Pestana = 'leche' | 'queso';
type TipoCliente = PrecioQuesoResponse['modalidad'];

const ETIQUETAS_MODALIDAD: Record<TipoCliente, string> = {
  MAYORISTA: 'Mayorista',
  PROVEEDOR: 'Proveedor',
  PUBLICO: 'Público'
};
const MODALIDADES: TipoCliente[] = ['MAYORISTA', 'PROVEEDOR', 'PUBLICO'];
const TAMANOS_PAGINA = [10, 20, 50];
const TAMANO_PAGINA_POR_DEFECTO = 20;

@Component({
  selector: 'app-precios-page',
  imports: [DataTableComponent, NgTemplateOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './precios-page.html',
  styleUrl: './precios-page.css'
})
export class PreciosPage {
  private readonly preciosApi = inject(PreciosApi);
  private readonly preciosQuesoApi = inject(PreciosQuesoApi);
  private readonly familiasApi = inject(FamiliasApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);
  private readonly destroy = inject(DestroyRef);

  protected readonly pestana = signal<Pestana>('leche');
  private readonly hoyIso = new Date().toISOString().slice(0, 10);
  protected readonly modalidades = MODALIDADES;
  protected readonly tamanosPagina = TAMANOS_PAGINA;

  // --- Leche: histórico paginado en el servidor; el vigente viene de su propio endpoint ---
  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  private readonly precios = signal<PrecioLitroResponse[]>([]);
  protected readonly paginaLeche = signal(0);
  protected readonly totalElementosLeche = signal(0);
  protected readonly totalPaginasLeche = signal(0);
  protected readonly precioVigente = signal<PrecioLitroResponse | null>(null);
  private peticionLeche?: Subscription;

  protected readonly columnas: ColumnaTabla[] = [
    { clave: 'vigenteDesde', etiqueta: 'Vigente desde' },
    { clave: 'precio', etiqueta: 'Precio / litro', alinearFin: true },
    { clave: 'estado', etiqueta: 'Estado' }
  ];

  /** Más reciente primero (orden del servidor); el histórico nunca se edita, solo se agregan filas nuevas. */
  protected readonly historial = computed(() => this.precios());

  // --- Productos (Fase 2: Precios por presentación, ampliada con organización por familia y paginación
  // real; antes "Queso" -- ahora cubre queso, yogurt, leche vendible, mantequilla, etc.) ---
  protected readonly cargandoQueso = signal(true);
  protected readonly errorQueso = signal<AppError | null>(null);
  protected readonly filas = signal<FilaPrecioPresentacionResponse[]>([]);
  protected readonly totalElementos = signal(0);
  protected readonly totalPaginas = signal(0);
  private peticionQueso?: Subscription;

  protected readonly familias = signal<FamiliaResponse[]>([]);
  protected readonly errorFamilias = signal(false);

  protected readonly filtroFamiliaId = signal('');
  /** Valor inmediato del input de búsqueda (para no perder tecleo mientras se espera el debounce). */
  protected readonly busquedaTexto = signal('');
  /** Valor ya estabilizado (debounced) que realmente se envía al servidor. */
  private readonly filtroBusqueda = signal('');
  private readonly busqueda$ = new Subject<string>();

  protected readonly tamanoPagina = signal(TAMANO_PAGINA_POR_DEFECTO);
  protected readonly pagina = signal(0);

  protected readonly columnasQueso: ColumnaTabla[] = [
    { clave: 'familiaNombre', etiqueta: 'Familia' },
    { clave: 'productoNombre', etiqueta: 'Producto' },
    { clave: 'presentacionNombre', etiqueta: 'Presentación' },
    { clave: 'MAYORISTA', etiqueta: 'Mayorista', alinearFin: true },
    { clave: 'PROVEEDOR', etiqueta: 'Proveedor', alinearFin: true },
    { clave: 'PUBLICO', etiqueta: 'Público', alinearFin: true },
    { clave: 'acciones', etiqueta: '' }
  ];

  protected readonly rangoMostrado = computed(() => {
    const total = this.totalElementos();
    if (total === 0) return 'Mostrando 0 de 0 resultados';
    const desde = this.pagina() * this.tamanoPagina() + 1;
    const hasta = Math.min(desde + this.tamanoPagina() - 1, total);
    return `Mostrando ${desde}–${hasta} de ${total} resultados`;
  });

  /** Un producto sin presentaciones no tiene id de presentación -- se usa el id del producto como llave
   *  (no puede colisionar con un id de presentación, son UUIDs de tablas distintas). */
  protected readonly identificarFilaPresentacion = (fila: FilaPrecioPresentacionResponse): string =>
    fila.presentacionId ?? `sin-presentacion:${fila.productoId}`;

  constructor() {
    this.cargar();
    this.cargarFamilias();
    this.cargarQueso();

    // Búsqueda con reinicio a la primera página y cancelación de consultas obsoletas: el debounce evita
    // una petición por tecla, y cargarQueso() cancela (unsubscribe) cualquier petición anterior todavía en
    // vuelo antes de lanzar la nueva.
    this.busqueda$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroy))
      .subscribe((valor) => {
        this.filtroBusqueda.set(valor);
        this.pagina.set(0);
        this.cargarQueso();
      });
  }

  protected estadoDe(precio: PrecioLitroResponse): 'Vigente' | 'Programado' | 'Anterior' {
    if (precio.vigenteDesde > this.hoyIso) return 'Programado';
    if (this.precioVigente()?.id === precio.id) return 'Vigente';
    return 'Anterior';
  }

  protected etiquetaModalidad(modalidad: TipoCliente): string {
    return ETIQUETAS_MODALIDAD[modalidad];
  }

  /** "2026-09-18" -> "18/09/2026", solo para mostrar; el dato que viaja y se guarda sigue siendo ISO. */
  protected formatearFecha(iso: string): string {
    const [anio, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${anio}`;
  }

  protected cargar(): void {
    this.peticionLeche?.unsubscribe();
    this.cargando.set(true);
    this.error.set(null);
    this.peticionLeche = this.preciosApi.listar({ page: this.paginaLeche(), size: TAMANO_PAGINA_POR_DEFECTO }).subscribe({
      next: (respuesta) => {
        const corregida = paginaCorregida(respuesta);
        if (corregida !== null) {
          this.paginaLeche.set(corregida);
          this.cargar();
          return;
        }
        this.precios.set(respuesta.contenido);
        this.totalElementosLeche.set(respuesta.totalElementos);
        this.totalPaginasLeche.set(respuesta.totalPaginas);
        this.cargando.set(false);
      },
      error: (error) => {
        this.error.set(mapHttpError(error));
        this.cargando.set(false);
      }
    });
    this.cargarVigente();
  }

  /** Independiente de la página visible: el vigente puede estar en cualquier página del histórico. */
  private cargarVigente(): void {
    this.preciosApi.vigente().subscribe({
      next: (precio) => this.precioVigente.set(precio),
      error: () => this.precioVigente.set(null) // no bloquea el histórico; solo se oculta la tarjeta
    });
  }

  protected irAPaginaLeche(delta: number): void {
    const siguiente = this.paginaLeche() + delta;
    if (siguiente < 0 || siguiente >= this.totalPaginasLeche()) return;
    this.paginaLeche.set(siguiente);
    this.cargar();
  }


  protected cargarFamilias(): void {
    this.errorFamilias.set(false);
    this.familiasApi.listar().subscribe({
      next: (familias) => this.familias.set(familias),
      // El filtro de familia es un complemento de la tabla, no una condición para verla: si falla, la
      // tabla principal sigue cargando y filtrando por búsqueda igual, solo sin ese selector poblado.
      error: () => this.errorFamilias.set(true)
    });
  }

  protected cargarQueso(): void {
    this.peticionQueso?.unsubscribe();
    this.cargandoQueso.set(true);
    this.errorQueso.set(null);
    this.peticionQueso = this.preciosQuesoApi
      .listarPaginado({
        page: this.pagina(),
        size: this.tamanoPagina(),
        familiaId: this.filtroFamiliaId() || undefined,
        busqueda: this.filtroBusqueda() || undefined
      })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (respuesta) => {
          this.filas.set(respuesta.contenido);
          this.totalElementos.set(respuesta.totalElementos);
          this.totalPaginas.set(respuesta.totalPaginas);
          this.cargandoQueso.set(false);
        },
        error: (error) => {
          this.errorQueso.set(mapHttpError(error));
          this.cargandoQueso.set(false);
        }
      });
  }

  protected cambiarFamilia(familiaId: string): void {
    this.filtroFamiliaId.set(familiaId);
    this.pagina.set(0);
    this.cargarQueso();
  }

  protected onBusquedaInput(valor: string): void {
    this.busquedaTexto.set(valor);
    this.busqueda$.next(valor.trim());
  }

  protected cambiarTamanoPagina(valor: number): void {
    this.tamanoPagina.set(valor);
    this.pagina.set(0);
    this.cargarQueso();
  }

  protected irAPaginaQueso(delta: number): void {
    const siguiente = this.pagina() + delta;
    if (siguiente < 0 || siguiente >= this.totalPaginas()) return;
    this.pagina.set(siguiente);
    this.cargarQueso();
  }

  protected registrarPrecio(): void {
    const ref = this.dialog.open<PrecioLitroResponse | undefined>(PrecioFormDialog, {
      ariaLabel: 'Registrar nuevo precio'
    });
    ref.closed.subscribe((precio) => {
      if (precio) {
        this.toast.exito(`Precio S/ ${precio.precio} registrado desde ${precio.vigenteDesde}.`);
        this.paginaLeche.set(0);
        this.cargar();
      }
    });
  }

  protected registrarPrecioPresentacion(fila: FilaPrecioPresentacionResponse): void {
    if (!fila.presentacionId || !fila.presentacionNombre) return; // sin presentación no hay a qué asociarle un precio (ver Catálogos)
    const presentacion: PresentacionResponse = {
      id: fila.presentacionId,
      productoId: fila.productoId,
      nombre: fila.presentacionNombre,
      contenidoCantidad: null,
      contenidoUnidad: null,
      unidadConteo: '',
      activo: true
    };
    const ref = this.dialog.open<PrecioQuesoResponse | undefined>(PrecioQuesoFormDialog, {
      ariaLabel: `Registrar precio de ${fila.presentacionNombre}`,
      data: { presentacion, productoNombre: fila.productoNombre }
    });
    ref.closed.subscribe((precio) => {
      if (precio) {
        this.toast.exito(`Precio de ${fila.productoNombre} — ${precio.presentacionNombre} (${this.etiquetaModalidad(precio.modalidad)}) registrado.`);
        this.cargarQueso(); // conserva familia/búsqueda/página actuales
      }
    });
  }

  protected verHistorial(fila: FilaPrecioPresentacionResponse): void {
    if (!fila.presentacionId || !fila.presentacionNombre) return;
    this.dialog.open(HistorialPrecioDialog, {
      ariaLabel: `Histórico de ${fila.presentacionNombre}`,
      data: {
        productoNombre: fila.productoNombre,
        presentacionNombre: fila.presentacionNombre,
        presentacionId: fila.presentacionId
      }
    });
  }
}
