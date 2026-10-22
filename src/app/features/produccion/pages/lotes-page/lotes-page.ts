import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { TAMANOS_PAGINA, TAMANO_PAGINA_POR_DEFECTO } from '../../../../shared/util/paginacion';
import { DecimalPipe } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../../core/auth/auth.service';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { InventarioApi } from '../../../inventario/data-access/inventario.api';
import { ProductoResponse } from '../../../catalogos/data-access/producto.models';
import { ProductosApi } from '../../../catalogos/data-access/productos.api';
import {
  ETIQUETA_ESTADO_LOTE,
  EstadoLote,
  LoteProduccion,
  estadoDe,
  totalObtenido
} from '../../data-access/lote-produccion.models';
import { LotesProduccionApi } from '../../data-access/lotes-produccion.api';
import { LoteDetalleDialog } from '../../ui/lote-detalle-dialog/lote-detalle-dialog';
import { ProduccionMultipleDialog, ProduccionMultipleResultado } from '../../ui/produccion-multiple-dialog/produccion-multiple-dialog';
import { RegistrarLoteDialog, RegistrarLoteDialogResultado } from '../../ui/registrar-lote-dialog/registrar-lote-dialog';


@Component({
  selector: 'app-lotes-page',
  imports: [DataTableComponent, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lotes-page.html',
  styleUrl: './lotes-page.css'
})
export class LotesPage {
  private readonly lotesApi = inject(LotesProduccionApi);
  private readonly productosApi = inject(ProductosApi);
  private readonly inventarioApi = inject(InventarioApi);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly lotes = signal<LoteProduccion[]>([]);
  protected readonly totalElementos = signal(0);
  protected readonly totalPaginas = signal(0);

  // Refactor de Producción, fase 4: informativo en la cabecera -- el backend es la autoridad real al
  // confirmar una producción, esto solo orienta antes de abrir el diálogo.
  protected readonly cargandoSaldoLeche = signal(true);
  protected readonly saldoLecheDisponible = signal<number | null>(null);

  protected readonly pagina = signal(0);
  protected readonly tamano = signal(TAMANO_PAGINA_POR_DEFECTO);
  protected readonly tamanos = TAMANOS_PAGINA;
  /** Texto del buscador estándar (producto o responsable): se envía al servidor y busca entre todos los lotes. */
  private readonly busquedaAplicada = signal('');
  private peticion?: Subscription;
  protected readonly filtroFecha = signal('');
  protected readonly filtroProducto = signal('');
  protected readonly filtroEstado = signal<EstadoLote | ''>('');

  protected readonly estados = Object.entries(ETIQUETA_ESTADO_LOTE) as [EstadoLote, string][];
  protected readonly estadoDe = estadoDe;
  protected readonly etiquetaEstado = (lote: LoteProduccion) => ETIQUETA_ESTADO_LOTE[estadoDe(lote)];
  protected readonly totalObtenido = totalObtenido;

  /** ADMIN usa /admin/productos; PRODUCCION usa /sync/cambios (mismo patrón que venta-form-dialog). */
  protected readonly productos = toSignal(
    this.auth.usuario()?.rolNombre === 'ADMIN' ? this.productosApi.listar() : this.productosApi.listarOperativo(),
    { initialValue: [] as ProductoResponse[] }
  );

  protected readonly columnas: ColumnaTabla[] = [
    { clave: 'fecha', etiqueta: 'Fecha' },
    { clave: 'productoNombre', etiqueta: 'Producto' },
    { clave: 'estado', etiqueta: 'Estado' },
    { clave: 'litrosUsados', etiqueta: 'Leche', alinearFin: true },
    { clave: 'esperado', etiqueta: 'Esperado', alinearFin: true },
    { clave: 'obtenido', etiqueta: 'Obtenido', alinearFin: true },
    { clave: 'rendimientoPct', etiqueta: 'Rendimiento', alinearFin: true },
    { clave: 'acciones', etiqueta: '' }
  ];

  constructor() {
    this.cargar();
    this.cargarSaldoLeche();
  }

  protected cargarSaldoLeche(): void {
    this.cargandoSaldoLeche.set(true);
    this.inventarioApi.obtenerSaldoLeche().subscribe({
      next: (saldo) => {
        this.saldoLecheDisponible.set(saldo.litrosDisponibles);
        this.cargandoSaldoLeche.set(false);
      },
      error: () => {
        // No bloquea el resto de la pagina: si falla, simplemente no se muestra el indicador.
        this.cargandoSaldoLeche.set(false);
      }
    });
  }

  protected cargar(): void {
    this.peticion?.unsubscribe();
    this.cargando.set(true);
    this.error.set(null);
    this.peticion = this.lotesApi
      .listar({
        page: this.pagina(),
        size: this.tamano(),
        fecha: this.filtroFecha() || undefined,
        productoId: this.filtroProducto() || undefined,
        estado: this.filtroEstado() || undefined,
        busqueda: this.busquedaAplicada() || undefined
      })
      .subscribe({
        next: (respuesta) => {
          this.lotes.set(respuesta.contenido);
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

  protected cambiarFiltroFecha(fecha: string): void {
    this.filtroFecha.set(fecha);
    this.pagina.set(0);
    this.cargar();
  }

  protected cambiarFiltroProducto(productoId: string): void {
    this.filtroProducto.set(productoId);
    this.pagina.set(0);
    this.cargar();
  }

  protected cambiarFiltroEstado(estado: string): void {
    this.filtroEstado.set(estado as EstadoLote | '');
    this.pagina.set(0);
    this.cargar();
  }

  protected buscar(texto: string): void {
    this.busquedaAplicada.set(texto);
    this.pagina.set(0);
    this.cargar();
  }

  protected cambiarPagina(pagina: number): void {
    if (pagina < 0 || pagina >= this.totalPaginas()) return;
    this.pagina.set(pagina);
    this.cargar();
  }

  protected cambiarTamano(tamano: number): void {
    this.tamano.set(tamano);
    this.pagina.set(0);
    this.cargar();
  }

  protected abrirDetalle(lote: LoteProduccion): void {
    const ref = this.dialog.open<boolean>(LoteDetalleDialog, {
      ariaLabel: `Detalle del lote de ${lote.productoNombre} del ${lote.fecha}`,
      data: { id: lote.id }
    });
    // Iniciar/finalizar/cancelar desde el detalle cambia estado y stock: refresca lista y saldo de leche.
    ref.closed.subscribe((huboCambios) => {
      if (!huboCambios) return;
      this.cargar();
      this.cargarSaldoLeche();
    });
  }

  /** Flujo principal (V18): producción desde receta, planificada y luego iniciada/finalizada. */
  protected nuevaProduccion(): void {
    const ref = this.dialog.open<ProduccionMultipleResultado>(ProduccionMultipleDialog, {
      ariaLabel: 'Nueva producción', disableClose: true
    });
    ref.closed.subscribe(() => {
      this.pagina.set(0);
      this.cargar();
      this.cargarSaldoLeche();
    });
  }

  /** Registro directo de una producción ya realizada (sin receta), en un solo paso. Mismo contrato que móvil. */
  protected registrarProduccion(): void {
    const ref = this.dialog.open<RegistrarLoteDialogResultado | undefined>(RegistrarLoteDialog, {
      ariaLabel: 'Registrar producción sin receta'
    });
    ref.closed.subscribe((resultado) => {
      if (!resultado) return;
      this.toast.exito(`Lote de "${resultado.lote.productoNombre}" registrado.`);
      this.pagina.set(0);
      this.cargar();
      this.cargarSaldoLeche(); // la produccion recien registrada consumio leche -- refresca el indicador
      if (resultado.verDetalle) {
        this.abrirDetalle(resultado.lote);
      }
    });
  }
}
