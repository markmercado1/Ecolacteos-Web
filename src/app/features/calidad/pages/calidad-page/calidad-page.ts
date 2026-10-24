import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Dialog } from '@angular/cdk/dialog';
import { Subscription } from 'rxjs';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { fechaHoyLima } from '../../../../shared/util/fecha';
import { Acopio, AcopiosApi } from '../../../acopios/acopios.api';
import { ZonaResponse } from '../../../catalogos/data-access/zona.models';
import { ZonasApi } from '../../../catalogos/data-access/zonas.api';
import { ProveedorPublicoResponse } from '../../../proveedores/data-access/proveedor.models';
import { ProveedoresApi } from '../../../proveedores/data-access/proveedores.api';
import {
  AlertaAnomalia,
  AnalisisBandeja,
  AnalisisCalidad,
  PrediccionProveedor,
  ScoreConfianza,
} from '../../data-access/calidad.models';
import { CalidadApi } from '../../data-access/calidad.api';
import { PreciosCalidadEntregaDialog } from '../../ui/precios-calidad-entrega-dialog/precios-calidad-entrega-dialog';
import { HistorialConsolidadoDialog } from '../../../historial-proveedor/ui/historial-consolidado-dialog/historial-consolidado-dialog';
import { ExportarExcelComponent } from '../../../../shared/ui/exportar-excel/exportar-excel';

type Pestana = 'pendientes' | 'bandeja' | 'consulta' | 'alertas';
type TipoBusqueda = 'folio' | 'registro';

@Component({
  selector: 'app-calidad-page',
  imports: [ExportarExcelComponent, DataTableComponent, LoadingStateComponent, ErrorStateComponent, EmptyStateComponent, DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calidad-page.html',
  styleUrl: './calidad-page.css',
})
export class CalidadPage {
  private readonly acopiosApi = inject(AcopiosApi);
  private readonly calidadApi = inject(CalidadApi);
  private readonly zonasApi = inject(ZonasApi);
  private readonly proveedoresApi = inject(ProveedoresApi);
  private readonly destroy = inject(DestroyRef);
  private readonly dialog = inject(Dialog);

  protected readonly hoy = fechaHoyLima;
  protected readonly pestana = signal<Pestana>('pendientes');

  protected readonly zonas = toSignal(this.zonasApi.listarOperativo(), { initialValue: [] as ZonaResponse[] });
  protected readonly proveedores = toSignal(this.proveedoresApi.listarOperativo(), {
    initialValue: [] as ProveedorPublicoResponse[],
  });

  // Entregas pendientes de análisis (reutiliza AcopiosApi.listar con sinAnalisis=true; Bloque 1 de Fase 4).
  protected readonly fechaPendientes = signal(fechaHoyLima());
  protected readonly zonaPendientes = signal('');
  protected readonly pendientes = signal<Acopio[]>([]);
  protected readonly cargandoPendientes = signal(false);
  protected readonly errorPendientes = signal<AppError | null>(null);
  private peticionPendientes?: Subscription;
  protected readonly columnasPendientes: ColumnaTabla[] = [
    { clave: 'fechaHora', etiqueta: 'Fecha y hora' },
    { clave: 'proveedorNombre', etiqueta: 'Proveedor' },
    { clave: 'litros', etiqueta: 'Litros', alinearFin: true },
    { clave: 'motivoObservacion', etiqueta: 'Observación' },
    { clave: 'acciones', etiqueta: '' },
  ];

  // Bandeja de analizados por fecha de entrega.
  protected readonly fechaBandeja = signal(fechaHoyLima());
  protected readonly bandeja = signal<AnalisisBandeja[]>([]);
  protected readonly cargandoBandeja = signal(false);
  protected readonly errorBandeja = signal<AppError | null>(null);
  protected readonly columnasBandeja: ColumnaTabla[] = [
    { clave: 'fechaHora', etiqueta: 'Fecha de entrega' },
    { clave: 'proveedorNombre', etiqueta: 'Proveedor' },
    { clave: 'litros', etiqueta: 'Litros', alinearFin: true },
    { clave: 'resultado', etiqueta: 'Resultado' },
    { clave: 'acciones', etiqueta: '' },
  ];

  // Consulta de análisis por folio o por registro de acopio.
  protected readonly tipoBusqueda = signal<TipoBusqueda>('folio');
  protected readonly textoBusqueda = signal('');
  protected readonly resultadosConsulta = signal<AnalisisCalidad[] | null>(null);
  protected readonly cargandoConsulta = signal(false);
  protected readonly errorConsulta = signal<AppError | null>(null);
  protected readonly columnasConsulta: ColumnaTabla[] = [
    { clave: 'folioMuestra', etiqueta: 'Folio' },
    { clave: 'agua', etiqueta: 'Agua', alinearFin: true },
    { clave: 'proteina', etiqueta: 'Proteína', alinearFin: true },
    { clave: 'lactosa', etiqueta: 'Lactosa', alinearFin: true },
    { clave: 'densidad', etiqueta: 'Densidad', alinearFin: true },
    { clave: 'temperatura', etiqueta: 'Temperatura', alinearFin: true },
    { clave: 'ph', etiqueta: 'pH', alinearFin: true },
    { clave: 'aguaAnadida', etiqueta: 'Agua añadida' },
    { clave: 'resultado', etiqueta: 'Resultado' },
    { clave: 'creadoEn', etiqueta: 'Registrado' },
    { clave: 'acciones', etiqueta: '' },
  ];

  // Alertas de anomalía por zona.
  protected readonly zonaAlertas = signal('');
  protected readonly alertas = signal<AlertaAnomalia[] | null>(null);
  protected readonly cargandoAlertas = signal(false);
  protected readonly errorAlertas = signal<AppError | null>(null);
  protected readonly columnasAlertas: ColumnaTabla[] = [
    { clave: 'creadoEn', etiqueta: 'Fecha' },
    { clave: 'proveedorNombre', etiqueta: 'Proveedor' },
    { clave: 'tipo', etiqueta: 'Tipo' },
    { clave: 'zScore', etiqueta: 'z-score', alinearFin: true },
    { clave: 'severidad', etiqueta: 'Severidad' },
  ];

  // Score de confianza y predicción de próxima entrega, por proveedor.
  protected readonly proveedorScore = signal('');
  protected readonly score = signal<ScoreConfianza | null>(null);
  protected readonly sinScore = signal(false);
  protected readonly cargandoScore = signal(false);
  protected readonly errorScore = signal<AppError | null>(null);
  protected readonly prediccion = signal<PrediccionProveedor | null>(null);
  protected readonly sinPrediccion = signal(false);
  protected readonly cargandoPrediccion = signal(false);
  protected readonly errorPrediccion = signal<AppError | null>(null);

  constructor() {
    this.cargarPendientes();
    this.cargarBandeja();
  }

  protected cambiarFechaPendientes(fecha: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return;
    this.fechaPendientes.set(fecha);
    this.cargarPendientes();
  }

  protected cambiarZonaPendientes(zonaId: string): void {
    this.zonaPendientes.set(zonaId);
    this.cargarPendientes();
  }

  protected cargarPendientes(): void {
    this.peticionPendientes?.unsubscribe();
    this.cargandoPendientes.set(true);
    this.errorPendientes.set(null);
    this.peticionPendientes = this.acopiosApi
      .listar({ fecha: this.fechaPendientes(), zonaId: this.zonaPendientes() || undefined, sinAnalisis: true })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.pendientes.set([...r].sort((a, b) => b.fechaHora.localeCompare(a.fechaHora)));
          this.cargandoPendientes.set(false);
        },
        error: (e) => {
          this.errorPendientes.set(mapHttpError(e));
          this.cargandoPendientes.set(false);
        },
      });
  }

  protected cambiarFechaBandeja(fecha: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return;
    this.fechaBandeja.set(fecha);
    this.cargarBandeja();
  }

  protected cargarBandeja(): void {
    this.cargandoBandeja.set(true);
    this.errorBandeja.set(null);
    this.calidadApi
      .bandeja(this.fechaBandeja())
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.bandeja.set(r);
          this.cargandoBandeja.set(false);
        },
        error: (e) => {
          this.errorBandeja.set(mapHttpError(e));
          this.cargandoBandeja.set(false);
        },
      });
  }

  /** Precios de calidad que se fijaron a una entrega al liquidar su pago (solo lectura; CALIDAD no accede a los pagos). */
  /** Historial consolidado del proveedor de esta entrega (CALIDAD recibe solo entregas y calidad; sin pagos). */
  protected verHistorialDelProveedor(proveedorId: string, proveedorNombre: string): void {
    this.dialog.open(HistorialConsolidadoDialog, {
      ariaLabel: `Historial consolidado de ${proveedorNombre}`,
      data: { proveedorId, proveedorNombre }
    });
  }

  protected verPreciosDeCalidad(registroAcopioId: string, proveedorNombre?: string): void {
    this.dialog.open(PreciosCalidadEntregaDialog, {
      ariaLabel: 'Precios de calidad de la entrega',
      data: { registroAcopioId, proveedorNombre }
    });
  }

  /** Desde la fila de un pendiente: salta a la pestaña de consulta ya buscando ese registro. */
  protected verAnalisisDeRegistro(registroAcopioId: string): void {
    this.pestana.set('consulta');
    this.tipoBusqueda.set('registro');
    this.textoBusqueda.set(registroAcopioId);
    this.buscarConsulta();
  }

  protected buscarConsulta(): void {
    const texto = this.textoBusqueda().trim();
    if (!texto) return;
    this.cargandoConsulta.set(true);
    this.errorConsulta.set(null);
    this.resultadosConsulta.set(null);
    const consulta =
      this.tipoBusqueda() === 'folio' ? this.calidadApi.porFolio(texto) : this.calidadApi.porRegistro(texto);
    consulta.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (r) => {
        this.resultadosConsulta.set(r);
        this.cargandoConsulta.set(false);
      },
      error: (e) => {
        this.errorConsulta.set(mapHttpError(e));
        this.cargandoConsulta.set(false);
      },
    });
  }

  protected cambiarZonaAlertas(zonaId: string): void {
    this.zonaAlertas.set(zonaId);
    this.alertas.set(null);
    this.errorAlertas.set(null);
    if (!zonaId) return;
    this.cargandoAlertas.set(true);
    this.calidadApi
      .alertasPorZona(zonaId)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.alertas.set(r);
          this.cargandoAlertas.set(false);
        },
        error: (e) => {
          this.errorAlertas.set(mapHttpError(e));
          this.cargandoAlertas.set(false);
        },
      });
  }

  protected cambiarProveedorScore(proveedorId: string): void {
    this.proveedorScore.set(proveedorId);
    this.score.set(null);
    this.sinScore.set(false);
    this.errorScore.set(null);
    this.prediccion.set(null);
    this.sinPrediccion.set(false);
    this.errorPrediccion.set(null);
    if (!proveedorId) return;

    this.cargandoScore.set(true);
    this.calidadApi
      .score(proveedorId)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (s) => {
          this.score.set(s);
          this.cargandoScore.set(false);
        },
        error: (e) => {
          this.cargandoScore.set(false);
          // 404 = sin histórico suficiente para calcular el score todavía (falta de cálculo, no un error real).
          if (e instanceof HttpErrorResponse && e.status === 404) this.sinScore.set(true);
          else this.errorScore.set(mapHttpError(e));
        },
      });

    this.cargandoPrediccion.set(true);
    this.calidadApi
      .prediccion(proveedorId)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (p) => {
          this.prediccion.set(p);
          this.cargandoPrediccion.set(false);
        },
        error: (e) => {
          this.cargandoPrediccion.set(false);
          if (e instanceof HttpErrorResponse && e.status === 404) this.sinPrediccion.set(true);
          else this.errorPrediccion.set(mapHttpError(e));
        },
      });
  }
}
