import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Dialog } from '@angular/cdk/dialog';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { BuscadorComponent } from '../../../../shared/ui/buscador/buscador';
import { PaginadorComponent } from '../../../../shared/ui/paginador/paginador';
import { paginaCorregida, TAMANOS_PAGINA, TAMANO_PAGINA_POR_DEFECTO } from '../../../../shared/util/paginacion';
import { ZonaResponse } from '../../../catalogos/data-access/zona.models';
import { ZonasApi } from '../../../catalogos/data-access/zonas.api';
import { ComunicadoResponse } from '../../data-access/comunicado.models';
import { ComunicadosApi } from '../../data-access/comunicados.api';
import { ConfirmacionesDialog } from '../../ui/confirmaciones-dialog/confirmaciones-dialog';

@Component({
  selector: 'app-comunicados-page',
  imports: [ReactiveFormsModule, LoadingStateComponent, ErrorStateComponent, EmptyStateComponent, PaginadorComponent, BuscadorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comunicados-page.html',
  styleUrl: './comunicados-page.css'
})
export class ComunicadosPage {
  private readonly comunicadosApi = inject(ComunicadosApi);
  private readonly zonasApi = inject(ZonasApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly zonas = toSignal(this.zonasApi.listarAdmin(), { initialValue: [] as ZonaResponse[] });
  protected readonly zonasSeleccionadas = signal<Set<string>>(new Set());

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly comunicados = signal<ComunicadoResponse[]>([]);
  protected readonly pagina = signal(0);
  protected readonly tamano = signal(TAMANO_PAGINA_POR_DEFECTO);
  protected readonly tamanos = TAMANOS_PAGINA;
  /** Texto del buscador estándar (mensaje o zona): se envía al servidor y busca entre todos los comunicados. */
  protected readonly busqueda = signal('');
  protected readonly totalElementos = signal(0);
  protected readonly totalPaginas = signal(0);
  private peticion?: Subscription;
  protected readonly publicando = signal(false);
  protected readonly errorPublicar = signal<string | null>(null);

  protected readonly form = this.fb.group({
    mensaje: this.fb.nonNullable.control('')
  });

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.peticion?.unsubscribe();
    this.peticion = this.comunicadosApi.listar({ page: this.pagina(), size: this.tamano(), busqueda: this.busqueda() || undefined }).subscribe({
      next: (respuesta) => {
        const corregida = paginaCorregida(respuesta);
        if (corregida !== null) {
          this.pagina.set(corregida);
          this.cargar();
          return;
        }
        this.comunicados.set(respuesta.contenido);
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

  protected buscar(texto: string): void {
    this.busqueda.set(texto);
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

  protected alternarZona(zonaId: string, marcada: boolean): void {
    this.zonasSeleccionadas.update((actual) => {
      const copia = new Set(actual);
      if (marcada) copia.add(zonaId); else copia.delete(zonaId);
      return copia;
    });
  }

  protected publicar(): void {
    const mensaje = this.form.getRawValue().mensaje.trim();
    const zonaIds = [...this.zonasSeleccionadas()];

    if (!mensaje) {
      this.errorPublicar.set('Escribe un mensaje antes de publicar.');
      return;
    }
    if (zonaIds.length === 0) {
      this.errorPublicar.set('Selecciona al menos una zona.');
      return;
    }
    if (this.publicando()) return;

    this.publicando.set(true);
    this.errorPublicar.set(null);
    this.comunicadosApi.crear({ mensaje, zonaIds }).subscribe({
      next: () => {
        this.publicando.set(false);
        this.toast.exito('Comunicado publicado.');
        this.form.reset({ mensaje: '' });
        this.zonasSeleccionadas.set(new Set());
        // El nuevo es el más reciente: se recarga la primera página para que los totales y el orden
        // vengan del servidor (anteponerlo a mano dejaría la página con 21 filas y el total desfasado).
        this.pagina.set(0);
        this.cargar();
      },
      error: (error) => {
        this.publicando.set(false);
        this.errorPublicar.set(mapHttpError(error).mensaje);
      }
    });
  }

  protected nombresZonasSeleccionadas(): string {
    const seleccionadas = this.zonasSeleccionadas();
    if (seleccionadas.size === 0) return 'ninguna zona seleccionada';
    return this.zonas()
      .filter((z) => seleccionadas.has(z.id))
      .map((z) => z.nombre)
      .join(', ');
  }

  protected verConfirmaciones(comunicado: ComunicadoResponse): void {
    this.dialog.open(ConfirmacionesDialog, {
      ariaLabel: 'Confirmaciones del comunicado',
      data: { comunicado }
    });
  }
}
