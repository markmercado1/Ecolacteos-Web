import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { ZonaResponse } from '../../../catalogos/data-access/zona.models';
import { ZonasApi } from '../../../catalogos/data-access/zonas.api';
import { UsuarioResponse } from '../../../usuarios/data-access/usuario.models';
import { UsuariosApi } from '../../../usuarios/data-access/usuarios.api';
import { UnidadResponse } from '../../data-access/unidad.models';
import { UnidadesApi } from '../../data-access/unidades.api';
import { UnidadFormDialog } from '../../ui/unidad-form-dialog/unidad-form-dialog';

@Component({
  selector: 'app-unidades-page',
  imports: [DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unidades-page.html',
  styleUrl: './unidades-page.css'
})
export class UnidadesPage {
  private readonly unidadesApi = inject(UnidadesApi);
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly zonasApi = inject(ZonasApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly unidades = signal<UnidadResponse[]>([]);
  private readonly zonas = signal<ZonaResponse[]>([]);
  private readonly acopiadores = signal<UsuarioResponse[]>([]);
  private readonly todosLosUsuarios = signal<UsuarioResponse[]>([]);

  protected readonly busqueda = signal('');
  protected readonly zonaPorId = computed(() => new Map(this.zonas().map((z) => [z.id, z.nombre])));

  protected readonly columnas: ColumnaTabla[] = [
    { clave: 'placa', etiqueta: 'Placa' },
    { clave: 'capacidad', etiqueta: 'Capacidad' },
    { clave: 'zona', etiqueta: 'Zona' },
    { clave: 'responsableNombre', etiqueta: 'Responsable' },
    { clave: 'acciones', etiqueta: '' }
  ];

  protected readonly unidadesFiltradas = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    if (!termino) return this.unidades();
    return this.unidades().filter((u) =>
      `${u.placa} ${u.responsableNombre}`.toLowerCase().includes(termino)
    );
  });

  constructor() {
    this.cargar();
  }

  protected nombreZona(zonaId: string | null): string {
    if (!zonaId) return 'Sin zona';
    return this.zonaPorId().get(zonaId) ?? 'Zona no encontrada';
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.zonasApi.listarAdmin().subscribe({ next: (z) => this.zonas.set(z), error: () => undefined });
    this.usuariosApi.listar().subscribe({
      next: (usuarios) => {
        this.todosLosUsuarios.set(usuarios);
        this.acopiadores.set(usuarios.filter((u) => u.rolNombre === 'ACOPIADOR' && u.activo));
      },
      error: () => undefined
    });
    this.unidadesApi.listar().subscribe({
      next: (unidades) => {
        this.unidades.set(unidades);
        this.cargando.set(false);
      },
      error: (error) => {
        this.error.set(mapHttpError(error));
        this.cargando.set(false);
      }
    });
  }

  /** Crea una unidad nueva (placa, capacidad, zona, responsable) -- no reasigna una ya existente. */
  protected nuevaUnidad(): void {
    this.abrirFormulario();
  }

  protected editarUnidad(unidad: UnidadResponse): void {
    this.abrirFormulario(unidad);
  }

  private abrirFormulario(unidad?: UnidadResponse): void {
    // Si el responsable actual de la unidad no está entre los acopiadores
    // activos, se busca su ficha completa para mostrarlo explícitamente en
    // el diálogo (rol y estado reales), en vez de sustituirlo en silencio.
    const responsableActual =
      unidad && !this.acopiadores().some((a) => a.id === unidad.responsableId)
        ? this.todosLosUsuarios().find((u) => u.id === unidad.responsableId)
        : undefined;

    const ref = this.dialog.open<UnidadResponse | undefined>(UnidadFormDialog, {
      ariaLabel: unidad ? 'Editar unidad' : 'Nueva unidad',
      data: { responsables: this.acopiadores(), unidad, responsableActual }
    });
    ref.closed.subscribe((resultado) => {
      if (!resultado) return;
      this.toast.exito(unidad ? `Unidad "${resultado.placa}" actualizada.` : `Unidad "${resultado.placa}" creada.`);
      this.cargar();
    });
  }
}
