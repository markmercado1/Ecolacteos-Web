import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../core/http/app-error';
import { ListaLocal } from '../../util/lista-local';
import { DescargaArchivos } from '../../util/descarga-archivos';
import { ColumnaTabla, DataTableComponent } from '../data-table/data-table';
import { ArchivoExportado } from '../exportar-excel/exportacion-excel.api';
import { ToastService } from '../toast/toast.service';
import { ImportacionExcelApi } from './importacion-excel.api';
import {
  ETIQUETA_ESTADO_FILA,
  EstadoFilaImportacion,
  FilaImportacion,
  ResultadoImportacion,
  TipoImportacion,
  VistaPreviaImportacion
} from './importacion-excel.models';

export interface ImportarExcelDialogData {
  tipo: TipoImportacion;
  /** Nombre en plural para los textos: «proveedores», «insumos». */
  nombre: string;
}

type Paso = 'archivo' | 'revision' | 'resultado';
type FiltroFilas = 'TODAS' | EstadoFilaImportacion;

/** Debe coincidir con el límite del servidor (app.excel.importacion.max-bytes); el servidor es quien lo hace cumplir. */
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Importación de datos maestros desde un Excel, en tres pasos: elegir el archivo de la plantilla oficial, revisar la vista
 * previa que calcula el servidor (válidas, inválidas, duplicadas) y confirmar. Hasta confirmar NO se guarda nada. Las filas
 * con error o duplicadas se omiten y quedan en un reporte descargable. Cierra devolviendo cuántos registros se crearon
 * (o `undefined` si no se importó nada).
 */
@Component({
  selector: 'app-importar-excel-dialog',
  imports: [DataTableComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="importar-titulo">Importar {{ data.nombre }} desde Excel</h2>
      <button type="button" class="close" (click)="cerrar()" aria-label="Cerrar">×</button>
    </div>

    <div class="dialog-body" aria-labelledby="importar-titulo">
      @switch (paso()) {
        @case ('archivo') {
          <p class="intro">
            Solo se aceptan archivos creados con la <strong>plantilla oficial</strong>: con otra estructura se rechazan. No se guarda nada hasta que revises
            y confirmes.
          </p>
          <ol class="pasos">
            <li>
              Descarga la plantilla y llénala (una fila por registro).
              <button type="button" class="btn" (click)="descargarPlantilla()" [disabled]="trabajando()">Descargar plantilla</button>
            </li>
            <li>Súbela aquí. Revisaremos cada fila y te mostraremos qué se importaría.</li>
          </ol>
          <div class="field" [class.has-error]="!!errorArchivo()">
            <label for="importar-archivo">Archivo de Excel (.xlsx)</label>
            <input
              id="importar-archivo"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              (change)="elegirArchivo($event)"
            >
            @if (errorArchivo(); as mensaje) { <span class="error" role="alert">{{ mensaje }}</span> }
          </div>
          @if (errorServidor(); as mensaje) { <p class="server-error" role="alert">{{ mensaje }}</p> }
          <div class="dialog-foot">
            <button type="button" class="btn" (click)="cerrar()">Cancelar</button>
            <button type="button" class="btn primary" [disabled]="!archivo() || trabajando()" (click)="revisar()">
              {{ trabajando() ? 'Revisando…' : 'Revisar archivo' }}
            </button>
          </div>
        }

        @case ('revision') {
          @if (vista(); as v) {
            <p class="intro">Archivo <strong>{{ v.nombreArchivo }}</strong>: {{ v.totalFilas }} filas con datos. Esto es lo que se haría; todavía no se guardó nada.</p>
            <div class="resumen" role="status">
              <span class="badge"><strong>{{ v.validas }}</strong> válidas</span>
              <span class="badge red"><strong>{{ v.invalidas }}</strong> con error</span>
              <span class="badge amber"><strong>{{ v.duplicadas }}</strong> duplicadas</span>
              @if (v.omitidas > 0) { <span class="badge gray"><strong>{{ v.omitidas }}</strong> en blanco</span> }
            </div>
            @if (v.invalidas + v.duplicadas > 0) {
              <p class="aviso">
                Las {{ v.invalidas + v.duplicadas }} filas con error o duplicadas <strong>se omitirán</strong>; solo se crearán las {{ v.validas }} válidas.
                Descarga el reporte para corregir las demás.
              </p>
            }
            @if (v.validas === 0) { <p class="server-error" role="alert">No hay ninguna fila válida para importar.</p> }
            <div class="tabs" role="tablist" aria-label="Filtrar filas">
              @for (opcion of opcionesFiltro(); track opcion.valor) {
                <button type="button" class="tab" role="tab" [class.active]="filtro() === opcion.valor" [attr.aria-selected]="filtro() === opcion.valor" (click)="filtro.set(opcion.valor)">
                  {{ opcion.etiqueta }}
                </button>
              }
            </div>
            <ng-container *ngTemplateOutlet="tabla" />
            @if (errorServidor(); as mensaje) { <p class="server-error" role="alert">{{ mensaje }}</p> }
            <div class="dialog-foot">
              @if (v.invalidas + v.duplicadas > 0) {
                <button type="button" class="btn" (click)="descargarReporte(v.id)" [disabled]="trabajando()">Descargar reporte de errores</button>
              }
              <span class="espacio"></span>
              <button type="button" class="btn" (click)="cerrar()" [disabled]="trabajando()">Cancelar</button>
              <button type="button" class="btn primary" [disabled]="!v.puedeConfirmar || trabajando()" (click)="confirmar()">
                {{ trabajando() ? 'Importando…' : 'Confirmar e importar ' + v.validas + ' ' + (v.validas === 1 ? 'fila' : 'filas') }}
              </button>
            </div>
          }
        }

        @case ('resultado') {
          @if (resultado(); as r) {
            <div class="resultado" role="status" aria-live="polite">
              <p class="grande">
                @if (r.creadas > 0) {
                  Se {{ r.creadas === 1 ? 'importó' : 'importaron' }} <strong>{{ r.creadas }}</strong> {{ r.creadas === 1 ? 'registro' : 'registros' }}.
                } @else {
                  No se creó ningún registro.
                }
              </p>
              @if (r.yaConfirmada) { <p class="hint">Esta importación ya estaba confirmada: no se creó nada nuevo.</p> }
              <div class="resumen">
                <span class="badge"><strong>{{ r.creadas }}</strong> creadas</span>
                @if (r.invalidas > 0) { <span class="badge red"><strong>{{ r.invalidas }}</strong> con error</span> }
                @if (r.duplicadas > 0) { <span class="badge amber"><strong>{{ r.duplicadas }}</strong> duplicadas</span> }
                @if (r.omitidas > 0) { <span class="badge gray"><strong>{{ r.omitidas }}</strong> omitidas</span> }
              </div>
            </div>
            @if (r.filasNoCreadas.length > 0) {
              <p class="aviso">Estas filas no se importaron:</p>
              <ng-container *ngTemplateOutlet="tabla" />
            }
            <div class="dialog-foot">
              @if (r.filasNoCreadas.length > 0) {
                <button type="button" class="btn" (click)="descargarReporte(r.id)" [disabled]="trabajando()">Descargar reporte de errores</button>
              }
              <span class="espacio"></span>
              <button type="button" class="btn primary" (click)="cerrar()">Cerrar</button>
            </div>
          }
        }
      }
    </div>

    <ng-template #tabla>
      <ui-data-table
        [columnas]="columnasTabla()"
        [lista]="lista"
        unidad="filas"
        mensajeVacio="No hay filas en esta categoría."
        placeholderBusqueda="Buscar en las filas"
        etiquetaBusqueda="Buscar en las filas del archivo"
      >
        <ng-template #celda let-fila let-columna="columna">
          @switch (columna) {
            @case ('fila') { {{ fila.fila }} }
            @case ('estado') { <span class="badge" [class.red]="fila.estado === 'INVALIDA'" [class.amber]="fila.estado === 'DUPLICADA' || fila.estado === 'OMITIDA'">{{ etiquetaEstado(fila.estado) }}</span> }
            @case ('motivo') { {{ fila.mensajes.join(' ') || '—' }} }
            @default { {{ valor(fila, columna) }} }
          }
        </ng-template>
      </ui-data-table>
    </ng-template>
  `,
  styles: `
    :host {
      display: block; width: min(56rem, 100%); max-height: 92vh; overflow: auto; background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay);
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; }
    .dialog-body { padding: var(--space-6); }
    .intro { margin: 0 0 var(--space-4); line-height: 1.5; }
    .pasos { margin: 0 0 var(--space-4); padding-left: var(--space-5); line-height: 1.6; }
    .pasos li { margin-bottom: var(--space-2); }
    .pasos .btn { margin-left: var(--space-2); }
    .resumen { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-4); }
    .aviso { background: var(--color-warning-bg); color: var(--color-warning); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: 0 0 var(--space-4); }
    .hint { color: var(--color-text-muted); font-size: var(--font-size-sm); margin: 0 0 var(--space-3); }
    .grande { font-size: var(--font-size-lg); margin: 0 0 var(--space-3); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: var(--space-3) 0; }
    .dialog-foot { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-top: var(--space-4); }
    .dialog-foot .espacio { flex: 1; }
  `
})
export class ImportarExcelDialog {
  protected readonly dialogRef = inject(DialogRef<number | undefined>);
  protected readonly data = inject<ImportarExcelDialogData>(DIALOG_DATA);
  private readonly api = inject(ImportacionExcelApi);
  private readonly descarga = inject(DescargaArchivos);
  private readonly toast = inject(ToastService);

  protected readonly paso = signal<Paso>('archivo');
  protected readonly archivo = signal<File | null>(null);
  protected readonly errorArchivo = signal<string | null>(null);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly trabajando = signal(false);
  protected readonly vista = signal<VistaPreviaImportacion | null>(null);
  protected readonly resultado = signal<ResultadoImportacion | null>(null);
  protected readonly filtro = signal<FiltroFilas>('TODAS');

  /** Filas del paso actual: todas las del archivo en la revisión; solo las no creadas en el resultado. */
  private readonly filasBase = computed<FilaImportacion[]>(() =>
    this.paso() === 'resultado' ? (this.resultado()?.filasNoCreadas ?? []) : (this.vista()?.filas ?? [])
  );
  private readonly filasFiltradas = computed(() => {
    const filtro = this.filtro();
    return filtro === 'TODAS' ? this.filasBase() : this.filasBase().filter((f) => f.estado === filtro);
  });
  protected readonly lista = new ListaLocal<FilaImportacion>(this.filasFiltradas, {
    campos: (f) => [String(f.fila), ...Object.values(f.valores), ...f.mensajes],
    id: (f) => String(f.fila),
    tamano: 10
  });

  protected readonly opcionesFiltro = computed<{ valor: FiltroFilas; etiqueta: string }[]>(() => {
    const v = this.vista();
    if (!v) return [];
    return [
      { valor: 'TODAS', etiqueta: `Todas (${v.totalFilas})` },
      { valor: 'VALIDA', etiqueta: `Válidas (${v.validas})` },
      { valor: 'INVALIDA', etiqueta: `Con error (${v.invalidas})` },
      { valor: 'DUPLICADA', etiqueta: `Duplicadas (${v.duplicadas})` }
    ];
  });

  protected readonly columnasTabla = computed<ColumnaTabla[]>(() => {
    const columnas = this.vista()?.columnas ?? this.resultado()?.columnas ?? [];
    return [
      { clave: 'fila', etiqueta: 'Fila' },
      { clave: 'estado', etiqueta: 'Resultado' },
      ...columnas.map((c) => ({ clave: `v:${c.clave}`, etiqueta: c.encabezado })),
      { clave: 'motivo', etiqueta: 'Motivo' }
    ];
  });

  private confirmada = false;

  constructor() {
    // Cerrar de cualquier forma (X, Escape, clic afuera) sin confirmar descarta la vista previa en el servidor.
    this.dialogRef.closed.subscribe(() => this.descartarSiHaceFalta());
  }

  protected etiquetaEstado(estado: EstadoFilaImportacion): string {
    return ETIQUETA_ESTADO_FILA[estado];
  }

  protected valor(fila: FilaImportacion, columna: string): string {
    const texto = fila.valores[columna.replace(/^v:/, '')];
    return texto && texto.length > 0 ? texto : '—';
  }

  protected elegirArchivo(evento: Event): void {
    const archivo = (evento.target as HTMLInputElement).files?.[0] ?? null;
    this.errorServidor.set(null);
    this.archivo.set(null);
    if (!archivo) {
      this.errorArchivo.set(null);
      return;
    }
    if (!archivo.name.toLowerCase().endsWith('.xlsx')) {
      this.errorArchivo.set('Solo se aceptan archivos .xlsx. Guarda el archivo en Excel como «Libro de Excel (.xlsx)».');
      return;
    }
    if (archivo.size > MAX_BYTES) {
      this.errorArchivo.set(`El archivo pesa ${Math.ceil(archivo.size / 1024)} KB y el máximo es ${MAX_BYTES / 1024} KB. Divide la carga en varios archivos.`);
      return;
    }
    this.errorArchivo.set(null);
    this.archivo.set(archivo);
  }

  protected descargarPlantilla(): void {
    this.descargarArchivo(this.api.plantilla(this.data.tipo));
  }

  protected descargarReporte(id: string): void {
    this.descargarArchivo(this.api.reporte(id));
  }

  private descargarArchivo(origen: ReturnType<ImportacionExcelApi['plantilla']>): void {
    if (this.trabajando()) return;
    this.trabajando.set(true);
    origen.subscribe({
      next: ({ blob, nombre }: ArchivoExportado) => {
        this.trabajando.set(false);
        this.descarga.guardar(blob, nombre);
      },
      error: (error) => {
        this.trabajando.set(false);
        this.toast.error(mapHttpError(error).mensaje);
      }
    });
  }

  protected revisar(): void {
    const archivo = this.archivo();
    if (!archivo || this.trabajando()) return;
    this.trabajando.set(true);
    this.errorServidor.set(null);
    this.api.previsualizar(this.data.tipo, archivo).subscribe({
      next: (vista) => {
        this.trabajando.set(false);
        this.vista.set(vista);
        this.filtro.set('TODAS');
        this.lista.buscar('');
        this.paso.set('revision');
      },
      error: (error) => {
        this.trabajando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }

  protected confirmar(): void {
    const vista = this.vista();
    if (!vista || !vista.puedeConfirmar || this.trabajando()) return;
    this.trabajando.set(true);
    this.errorServidor.set(null);
    this.api.confirmar(vista.id).subscribe({
      next: (resultado) => {
        this.trabajando.set(false);
        this.confirmada = true;
        this.resultado.set(resultado);
        this.filtro.set('TODAS');
        this.lista.buscar('');
        this.paso.set('resultado');
      },
      error: (error) => {
        // La vista previa sigue vigente en el servidor (nada se guardó): se puede reintentar.
        this.trabajando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }

  protected cerrar(): void {
    this.dialogRef.close(this.resultado()?.creadas ? this.resultado()?.creadas : undefined);
  }

  private descartarSiHaceFalta(): void {
    const vista = this.vista();
    if (vista && !this.confirmada) {
      this.api.cancelar(vista.id).subscribe({ error: () => undefined });
    }
  }
}
