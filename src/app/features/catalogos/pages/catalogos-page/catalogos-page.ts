import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { ActivatedRoute } from '@angular/router';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { CampoUnicoDialog } from '../../../../shared/ui/dialog/campo-unico-dialog';
import { ConfirmDialog } from '../../../../shared/ui/dialog/confirm-dialog';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { ListaLocal } from '../../../../shared/util/lista-local';
import { ConfiguracionApi } from '../../data-access/configuracion.api';
import { ConfiguracionSistemaResponse } from '../../data-access/configuracion.models';
import { InsumoResponse } from '../../data-access/insumo.models';
import { InsumosApi } from '../../data-access/insumos.api';
import { MotivoObservacionResponse } from '../../data-access/motivo.models';
import { MotivosApi } from '../../data-access/motivos.api';
import { FamiliaResponse } from '../../data-access/familia.models';
import { FamiliasApi } from '../../data-access/familias.api';
import { urlFotoCatalogo } from '../../data-access/foto-catalogo';
import { ProductoResponse } from '../../data-access/producto.models';
import { RecetaResponse } from '../../data-access/receta.models';
import { RecetasApi } from '../../data-access/recetas.api';
import { ProductosApi } from '../../data-access/productos.api';
import { ZonaResponse } from '../../data-access/zona.models';
import { ZonasApi } from '../../data-access/zonas.api';
import { InsumoFormDialog } from '../../ui/insumo-form-dialog/insumo-form-dialog';
import { ProductoFormDialog, ProductoFormDialogResultado } from '../../ui/producto-form-dialog/producto-form-dialog';
import { PresentacionesDialog } from '../../ui/presentaciones-dialog/presentaciones-dialog';
import { RecetaFormDialog } from '../../ui/receta-form-dialog/receta-form-dialog';
import { ControlVencimientoDialog } from '../../../vencimiento/ui/control-vencimiento-dialog/control-vencimiento-dialog';
import { ExportarExcelComponent } from '../../../../shared/ui/exportar-excel/exportar-excel';

/** Id del registro que devolvió el diálogo al guardar (para mostrarlo y resaltarlo en la tabla). */
const idDe = (resultado: unknown): string | undefined => (resultado as { id?: string } | null)?.id;

type Pestana = 'zonas' | 'motivos' | 'familias' | 'productos' | 'insumos' | 'recetas' | 'configuracion';
const PESTANAS: Pestana[] = ['zonas', 'motivos', 'familias', 'productos', 'insumos', 'recetas', 'configuracion'];

const AVISO_LIMITACION_INACTIVOS =
  'Este catálogo solo lista registros activos. Al desactivar uno, desaparece de esta lista y no podrás reactivarlo desde aquí (la API no ofrece ver inactivos).';

@Component({
  selector: 'app-catalogos-page',
  imports: [ExportarExcelComponent, DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalogos-page.html',
  styleUrl: './catalogos-page.css'
})
export class CatalogosPage {
  private readonly zonasApi = inject(ZonasApi);
  private readonly motivosApi = inject(MotivosApi);
  private readonly familiasApi = inject(FamiliasApi);
  private readonly productosApi = inject(ProductosApi);
  private readonly insumosApi = inject(InsumosApi);
  private readonly configuracionApi = inject(ConfiguracionApi);
  private readonly recetasApi = inject(RecetasApi);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  /** ?pestana=recetas|insumos... permite llegar directo desde Producción (p. ej. para reponer stock). */
  protected readonly pestana = signal<Pestana>(this.pestanaInicial());
  protected readonly avisoLimitacion = AVISO_LIMITACION_INACTIVOS;

  protected readonly cargandoZonas = signal(true);
  protected readonly errorZonas = signal<AppError | null>(null);
  protected readonly zonas = signal<ZonaResponse[]>([]);

  protected readonly cargandoMotivos = signal(true);
  protected readonly errorMotivos = signal<AppError | null>(null);
  protected readonly motivos = signal<MotivoObservacionResponse[]>([]);

  protected readonly cargandoFamilias = signal(true);
  protected readonly errorFamilias = signal<AppError | null>(null);
  protected readonly familias = signal<FamiliaResponse[]>([]);

  protected readonly cargandoProductos = signal(true);
  protected readonly errorProductos = signal<AppError | null>(null);
  protected readonly productos = signal<ProductoResponse[]>([]);

  protected readonly cargandoInsumos = signal(true);
  protected readonly errorInsumos = signal<AppError | null>(null);
  protected readonly insumos = signal<InsumoResponse[]>([]);

  protected readonly cargandoRecetas = signal(true);
  protected readonly errorRecetas = signal<AppError | null>(null);
  protected readonly recetas = signal<RecetaResponse[]>([]);

  protected readonly cargandoConfig = signal(true);
  protected readonly errorConfig = signal<AppError | null>(null);
  protected readonly configuracion = signal<ConfiguracionSistemaResponse[]>([]);

  /**
   * Las APIs de catálogos entregan todo el conjunto activo en orden alfabético (no hay fecha de creación): cada tabla
   * se busca y pagina en el cliente sobre TODOS los registros, y el recién creado o editado se resalta unos segundos.
   */
  private readonly destroyRef = inject(DestroyRef);
  protected readonly listaZonas = new ListaLocal(this.zonas, {
    campos: (z) => [z.nombre], id: (z) => z.id, destroyRef: this.destroyRef
  });
  protected readonly listaMotivos = new ListaLocal(this.motivos, {
    campos: (m) => [m.descripcion], id: (m) => m.id, destroyRef: this.destroyRef
  });
  protected readonly listaFamilias = new ListaLocal(this.familias, {
    campos: (f) => [f.nombre], id: (f) => f.id, destroyRef: this.destroyRef
  });
  protected readonly listaProductos = new ListaLocal(this.productos, {
    campos: (p) => [p.nombre, p.familiaNombre], id: (p) => p.id, destroyRef: this.destroyRef
  });
  protected readonly listaInsumos = new ListaLocal(this.insumos, {
    campos: (i) => [i.nombre, i.unidadMedida], id: (i) => i.id, destroyRef: this.destroyRef
  });
  protected readonly listaRecetas = new ListaLocal(this.recetas, {
    campos: (r) => [r.nombre, r.productoNombre, r.presentacionNombre], id: (r) => r.id, destroyRef: this.destroyRef
  });
  protected readonly listaConfig = new ListaLocal(this.configuracion, {
    campos: (c) => [c.clave, c.valor, c.descripcion], id: (c) => c.clave, destroyRef: this.destroyRef
  });

  protected readonly columnasZonas: ColumnaTabla[] = [
    { clave: 'nombre', etiqueta: 'Zona' },
    { clave: 'acciones', etiqueta: '' }
  ];
  protected readonly columnasMotivos: ColumnaTabla[] = [
    { clave: 'descripcion', etiqueta: 'Motivo' },
    { clave: 'acciones', etiqueta: '' }
  ];
  protected readonly columnasFamilias: ColumnaTabla[] = [
    { clave: 'nombre', etiqueta: 'Familia' },
    { clave: 'acciones', etiqueta: '' }
  ];
  protected readonly columnasProductos: ColumnaTabla[] = [
    { clave: 'nombre', etiqueta: 'Producto' },
    { clave: 'familiaNombre', etiqueta: 'Familia' },
    { clave: 'presentacionesCount', etiqueta: 'Presentaciones', alinearFin: true },
    { clave: 'acciones', etiqueta: '' }
  ];
  protected readonly columnasInsumos: ColumnaTabla[] = [
    { clave: 'nombre', etiqueta: 'Insumo' },
    { clave: 'unidadMedida', etiqueta: 'Unidad de medida' },
    { clave: 'stock', etiqueta: 'Stock', alinearFin: true },
    { clave: 'acciones', etiqueta: '' }
  ];
  protected readonly columnasRecetas: ColumnaTabla[] = [
    { clave: 'nombre', etiqueta: 'Receta' },
    { clave: 'productoNombre', etiqueta: 'Producto' },
    { clave: 'base', etiqueta: 'Base' },
    { clave: 'insumos', etiqueta: 'Insumos' },
    { clave: 'activo', etiqueta: 'Estado' },
    { clave: 'acciones', etiqueta: '' }
  ];
  protected readonly columnasConfig: ColumnaTabla[] = [
    { clave: 'clave', etiqueta: 'Parámetro' },
    { clave: 'valor', etiqueta: 'Valor' },
    { clave: 'descripcion', etiqueta: 'Descripción' },
    { clave: 'acciones', etiqueta: '' }
  ];

  constructor() {
    this.cargarZonas();
    this.cargarMotivos();
    this.cargarFamilias();
    this.cargarProductos();
    this.cargarInsumos();
    this.cargarRecetas();
    this.cargarConfig();
  }

  private pestanaInicial(): Pestana {
    const pedida = this.route.snapshot.queryParamMap.get('pestana') as Pestana | null;
    return pedida && PESTANAS.includes(pedida) ? pedida : 'zonas';
  }

  protected cargarZonas(revelarId?: string): void {
    this.cargandoZonas.set(true);
    this.errorZonas.set(null);
    this.zonasApi.listarAdmin().subscribe({
      next: (z) => { this.zonas.set(z); this.cargandoZonas.set(false); if (revelarId) this.listaZonas.revelar(revelarId); },
      error: (e) => { this.errorZonas.set(mapHttpError(e)); this.cargandoZonas.set(false); }
    });
  }

  protected cargarMotivos(revelarId?: string): void {
    this.cargandoMotivos.set(true);
    this.errorMotivos.set(null);
    this.motivosApi.listar().subscribe({
      next: (m) => { this.motivos.set(m); this.cargandoMotivos.set(false); if (revelarId) this.listaMotivos.revelar(revelarId); },
      error: (e) => { this.errorMotivos.set(mapHttpError(e)); this.cargandoMotivos.set(false); }
    });
  }

  protected cargarFamilias(revelarId?: string): void {
    this.cargandoFamilias.set(true);
    this.errorFamilias.set(null);
    this.familiasApi.listar().subscribe({
      next: (f) => { this.familias.set(f); this.cargandoFamilias.set(false); if (revelarId) this.listaFamilias.revelar(revelarId); },
      error: (e) => { this.errorFamilias.set(mapHttpError(e)); this.cargandoFamilias.set(false); }
    });
  }

  protected cargarProductos(revelarId?: string): void {
    this.cargandoProductos.set(true);
    this.errorProductos.set(null);
    this.productosApi.listar().subscribe({
      next: (p) => { this.productos.set(p); this.cargandoProductos.set(false); if (revelarId) this.listaProductos.revelar(revelarId); },
      error: (e) => { this.errorProductos.set(mapHttpError(e)); this.cargandoProductos.set(false); }
    });
  }

  protected cargarInsumos(revelarId?: string): void {
    this.cargandoInsumos.set(true);
    this.errorInsumos.set(null);
    this.insumosApi.listar().subscribe({
      next: (i) => { this.insumos.set(i); this.cargandoInsumos.set(false); if (revelarId) this.listaInsumos.revelar(revelarId); },
      error: (e) => { this.errorInsumos.set(mapHttpError(e)); this.cargandoInsumos.set(false); }
    });
  }

  /** Incluye inactivas: a diferencia de otros catálogos, la API de recetas sí permite verlas y reactivarlas. */
  protected cargarRecetas(revelarId?: string): void {
    this.cargandoRecetas.set(true);
    this.errorRecetas.set(null);
    this.recetasApi.listar(true).subscribe({
      next: (r) => { this.recetas.set(r); this.cargandoRecetas.set(false); if (revelarId) this.listaRecetas.revelar(revelarId); },
      error: (e) => { this.errorRecetas.set(mapHttpError(e)); this.cargandoRecetas.set(false); }
    });
  }

  protected cargarConfig(): void {
    this.cargandoConfig.set(true);
    this.errorConfig.set(null);
    this.configuracionApi.listar().subscribe({
      next: (c) => { this.configuracion.set(c); this.cargandoConfig.set(false); },
      error: (e) => { this.errorConfig.set(mapHttpError(e)); this.cargandoConfig.set(false); }
    });
  }

  // --- Zonas ---
  protected nuevaZona(): void {
    const ref = this.dialog.open(CampoUnicoDialog, {
      ariaLabel: 'Nueva zona',
      data: {
        titulo: 'Nueva zona', etiquetaCampo: 'Nombre de la zona', valorInicial: '', etiquetaGuardar: 'Crear zona',
        guardar: (nombre: string) => this.zonasApi.crear({ nombre })
      }
    });
    ref.closed.subscribe((r) => { if (r) { this.toast.exito('Zona creada.'); this.cargarZonas(idDe(r)); } });
  }

  protected editarZona(zona: ZonaResponse): void {
    const ref = this.dialog.open(CampoUnicoDialog, {
      ariaLabel: 'Editar zona',
      data: {
        titulo: 'Editar zona', etiquetaCampo: 'Nombre de la zona', valorInicial: zona.nombre,
        guardar: (nombre: string) => this.zonasApi.actualizar(zona.id, { nombre })
      }
    });
    ref.closed.subscribe((r) => { if (r) { this.toast.exito('Zona actualizada.'); this.cargarZonas(idDe(r)); } });
  }

  protected desactivarZona(zona: ZonaResponse): void {
    this.confirmarDesactivacion(zona.nombre, () =>
      this.zonasApi.desactivar(zona.id).subscribe({
        next: () => { this.toast.exito('Zona desactivada.'); this.cargarZonas(); },
        error: (e) => this.toast.error(mapHttpError(e).mensaje)
      })
    );
  }

  // --- Motivos ---
  protected nuevoMotivo(): void {
    const ref = this.dialog.open(CampoUnicoDialog, {
      ariaLabel: 'Nuevo motivo',
      data: {
        titulo: 'Nuevo motivo de observación', etiquetaCampo: 'Descripción', valorInicial: '', etiquetaGuardar: 'Crear motivo',
        guardar: (descripcion: string) => this.motivosApi.crear({ descripcion })
      }
    });
    ref.closed.subscribe((r) => { if (r) { this.toast.exito('Motivo creado.'); this.cargarMotivos(idDe(r)); } });
  }

  protected editarMotivo(motivo: MotivoObservacionResponse): void {
    const ref = this.dialog.open(CampoUnicoDialog, {
      ariaLabel: 'Editar motivo',
      data: {
        titulo: 'Editar motivo', etiquetaCampo: 'Descripción', valorInicial: motivo.descripcion,
        guardar: (descripcion: string) => this.motivosApi.actualizar(motivo.id, { descripcion })
      }
    });
    ref.closed.subscribe((r) => { if (r) { this.toast.exito('Motivo actualizado.'); this.cargarMotivos(idDe(r)); } });
  }

  protected desactivarMotivo(motivo: MotivoObservacionResponse): void {
    this.confirmarDesactivacion(motivo.descripcion, () =>
      this.motivosApi.desactivar(motivo.id).subscribe({
        next: () => { this.toast.exito('Motivo desactivado.'); this.cargarMotivos(); },
        error: (e) => this.toast.error(mapHttpError(e).mensaje)
      })
    );
  }

  // --- Familias ---
  protected nuevaFamilia(): void {
    const ref = this.dialog.open(CampoUnicoDialog, {
      ariaLabel: 'Nueva familia',
      data: {
        titulo: 'Nueva familia', etiquetaCampo: 'Nombre de la familia', valorInicial: '', etiquetaGuardar: 'Crear familia',
        guardar: (nombre: string) => this.familiasApi.crear({ nombre })
      }
    });
    ref.closed.subscribe((r) => { if (r) { this.toast.exito('Familia creada.'); this.cargarFamilias(idDe(r)); } });
  }

  protected editarFamilia(familia: FamiliaResponse): void {
    const ref = this.dialog.open(CampoUnicoDialog, {
      ariaLabel: 'Editar familia',
      data: {
        titulo: 'Editar familia', etiquetaCampo: 'Nombre de la familia', valorInicial: familia.nombre,
        guardar: (nombre: string) => this.familiasApi.actualizar(familia.id, { nombre })
      }
    });
    ref.closed.subscribe((r) => { if (r) { this.toast.exito('Familia actualizada.'); this.cargarFamilias(idDe(r)); } });
  }

  protected desactivarFamilia(familia: FamiliaResponse): void {
    this.confirmarDesactivacion(familia.nombre, () =>
      this.familiasApi.desactivar(familia.id).subscribe({
        next: () => { this.toast.exito('Familia desactivada.'); this.cargarFamilias(); },
        error: (e) => this.toast.error(mapHttpError(e).mensaje)
      })
    );
  }

  // --- Productos (generaliza "Tipos de queso") ---
  // Corrección de UX (Fase 1): "Editar producto" y "Presentaciones" son acciones separadas -- no hace
  // falta entrar a editar el producto para gestionar sus tamaños/envases. Al CREAR un producto nuevo, este
  // diálogo se cierra y de inmediato se abre PresentacionesDialog (nunca apilados: el primero ya cerró
  // antes de abrir el segundo) -- al EDITAR uno existente, no se abre nada más.
  protected nuevoProducto(): void {
    const ref = this.dialog.open<ProductoFormDialogResultado | undefined>(ProductoFormDialog, { ariaLabel: 'Nuevo producto', data: {} });
    ref.closed.subscribe((r) => {
      if (!r) return;
      this.toast.exito(`Producto "${r.producto.nombre}" creado.`);
      if (r.errorFoto) this.avisarErrorFoto(r.errorFoto);
      this.cargarProductos(r.producto.id);
      if (r.esNuevo) this.abrirPresentaciones(r.producto, true);
    });
  }

  protected editarProducto(producto: ProductoResponse): void {
    const ref = this.dialog.open<ProductoFormDialogResultado | undefined>(ProductoFormDialog, {
      ariaLabel: 'Editar producto',
      data: { producto }
    });
    ref.closed.subscribe((r) => {
      if (!r) return;
      this.toast.exito(`Producto "${r.producto.nombre}" actualizado.`);
      if (r.errorFoto) this.avisarErrorFoto(r.errorFoto);
      this.cargarProductos(r.producto.id);
    });
  }

  protected urlFoto(fotoUrl: string | null | undefined): string | null {
    return urlFotoCatalogo(fotoUrl);
  }

  private avisarErrorFoto(detalle: string): void {
    this.toast.error(`El producto se guardó, pero la foto no: ${detalle} Puedes subirla de nuevo editando el producto.`);
  }

  protected abrirPresentaciones(producto: ProductoResponse, recienCreado = false): void {
    const ref = this.dialog.open<boolean>(PresentacionesDialog, {
      ariaLabel: `Presentaciones de ${producto.nombre}`,
      data: { producto, recienCreado }
    });
    ref.closed.subscribe((huboCambios) => { if (huboCambios) this.cargarProductos(); });
  }

  /** Fase 2: activar/desactivar el control de vencimiento de un producto (el estado se consulta al abrir el diálogo). */
  protected abrirControlVencimiento(producto: ProductoResponse): void {
    this.dialog.open<boolean>(ControlVencimientoDialog, {
      ariaLabel: `Control de vencimiento de ${producto.nombre}`,
      data: { productoId: producto.id, productoNombre: producto.nombre }
    });
  }

  protected desactivarProducto(producto: ProductoResponse): void {
    this.confirmarDesactivacion(producto.nombre, () =>
      this.productosApi.desactivar(producto.id).subscribe({
        next: () => { this.toast.exito('Producto desactivado.'); this.cargarProductos(); },
        error: (e) => this.toast.error(mapHttpError(e).mensaje)
      })
    );
  }

  // --- Insumos ---
  protected nuevoInsumo(): void {
    const ref = this.dialog.open<InsumoResponse | undefined>(InsumoFormDialog, { ariaLabel: 'Nuevo insumo', data: {} });
    ref.closed.subscribe((r) => { if (r) { this.toast.exito(`Insumo "${r.nombre}" creado.`); this.cargarInsumos(r.id); } });
  }

  protected editarInsumo(insumo: InsumoResponse): void {
    const ref = this.dialog.open<InsumoResponse | undefined>(InsumoFormDialog, {
      ariaLabel: 'Editar insumo',
      data: { insumo }
    });
    ref.closed.subscribe((r) => { if (r) { this.toast.exito(`Insumo "${r.nombre}" actualizado.`); this.cargarInsumos(r.id); } });
  }

  protected desactivarInsumo(insumo: InsumoResponse): void {
    this.confirmarDesactivacion(insumo.nombre, () =>
      this.insumosApi.desactivar(insumo.id).subscribe({
        next: () => { this.toast.exito('Insumo desactivado.'); this.cargarInsumos(); },
        error: (e) => this.toast.error(mapHttpError(e).mensaje)
      })
    );
  }

  // --- Recetas (V18) ---
  protected nuevaReceta(): void {
    const ref = this.dialog.open<RecetaResponse | undefined>(RecetaFormDialog, {
      ariaLabel: 'Nueva receta',
      data: { productos: this.productos(), insumos: this.insumos() }
    });
    ref.closed.subscribe((r) => { if (r) { this.toast.exito(`Receta "${r.nombre}" creada.`); this.cargarRecetas(r.id); } });
  }

  protected editarReceta(receta: RecetaResponse): void {
    const ref = this.dialog.open<RecetaResponse | undefined>(RecetaFormDialog, {
      ariaLabel: 'Editar receta',
      data: { receta, productos: this.productos(), insumos: this.insumos() }
    });
    ref.closed.subscribe((r) => { if (r) { this.toast.exito(`Receta "${r.nombre}" actualizada.`); this.cargarRecetas(r.id); } });
  }

  protected desactivarReceta(receta: RecetaResponse): void {
    const ref = this.dialog.open<boolean>(ConfirmDialog, {
      ariaLabel: 'Desactivar receta',
      data: {
        titulo: 'Desactivar receta',
        mensaje: `"${receta.nombre}" dejará de estar disponible para planificar. Las producciones ya planificadas no cambian. Puedes reactivarla después.`,
        etiquetaConfirmar: 'Desactivar',
        peligroso: true
      }
    });
    ref.closed.subscribe((confirmado) => {
      if (!confirmado) return;
      this.recetasApi.desactivar(receta.id).subscribe({
        next: () => { this.toast.exito('Receta desactivada.'); this.cargarRecetas(); },
        error: (e) => this.toast.error(mapHttpError(e).mensaje)
      });
    });
  }

  protected reactivarReceta(receta: RecetaResponse): void {
    this.recetasApi.reactivar(receta.id).subscribe({
      next: () => { this.toast.exito('Receta reactivada.'); this.cargarRecetas(); },
      error: (e) => this.toast.error(mapHttpError(e).mensaje)
    });
  }

  protected resumenInsumos(receta: RecetaResponse): string {
    return receta.insumos.length
      ? receta.insumos.map((i) => `${i.cantidad} ${i.unidadMedida} ${i.insumoNombre}`).join(' · ')
      : 'Solo leche';
  }

  // --- Configuración ---
  protected editarConfiguracion(item: ConfiguracionSistemaResponse): void {
    const ref = this.dialog.open(CampoUnicoDialog, {
      ariaLabel: `Editar ${item.clave}`,
      data: {
        titulo: item.clave,
        etiquetaCampo: item.descripcion,
        valorInicial: item.valor,
        etiquetaGuardar: 'Guardar valor',
        guardar: (valor: string) => this.configuracionApi.actualizar(item.clave, { valor })
      }
    });
    ref.closed.subscribe((r) => { if (r) { this.toast.exito(`"${item.clave}" actualizado.`); this.cargarConfig(); } });
  }

  private confirmarDesactivacion(nombre: string, siConfirma: () => void): void {
    const ref = this.dialog.open<boolean>(ConfirmDialog, {
      ariaLabel: 'Desactivar',
      data: {
        titulo: 'Desactivar registro',
        mensaje: `"${nombre}" se desactivará y desaparecerá de este listado. La API no permite verlo ni reactivarlo después desde esta pantalla.`,
        etiquetaConfirmar: 'Desactivar',
        peligroso: true
      }
    });
    ref.closed.subscribe((confirmado) => { if (confirmado) siConfirma(); });
  }
}
