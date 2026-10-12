import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { Observable, Subscription } from 'rxjs';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { CardComponent } from '../../../../shared/ui/card/card';
import { ConfirmDialog } from '../../../../shared/ui/dialog/confirm-dialog';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { PaginadorComponent } from '../../../../shared/ui/paginador/paginador';
import { paginaCorregida } from '../../../../shared/util/paginacion';
import { ZonaResponse } from '../../../catalogos/data-access/zona.models';
import { ZonasApi } from '../../../catalogos/data-access/zonas.api';
import { UnidadResponse } from '../../../unidades/data-access/unidad.models';
import { UnidadesApi } from '../../../unidades/data-access/unidades.api';
import { AsignarUnidadDialog, AsignarUnidadResultado } from '../../../unidades/ui/asignar-unidad-dialog/asignar-unidad-dialog';
import { UnidadFormDialog } from '../../../unidades/ui/unidad-form-dialog/unidad-form-dialog';
import { UsuarioResponse } from '../../../usuarios/data-access/usuario.models';
import { UsuariosApi } from '../../../usuarios/data-access/usuarios.api';
import { UsuarioFormDialog } from '../../../usuarios/ui/usuario-form-dialog/usuario-form-dialog';
import { NuevoAcopiadorDialog, NuevoAcopiadorResultado } from '../../ui/nuevo-acopiador-dialog/nuevo-acopiador-dialog';

/** Múltiplo de 3 para que la grilla de tarjetas (grid-3) quede completa. */
const TAMANO_PAGINA_ACOPIADORES = 12;

interface AcopiadorConUnidades {
  usuario: UsuarioResponse;
  unidades: UnidadResponse[];
}

@Component({
  selector: 'app-acopiadores-page',
  imports: [CardComponent, LoadingStateComponent, EmptyStateComponent, ErrorStateComponent, PaginadorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './acopiadores-page.html',
  styleUrl: './acopiadores-page.css'
})
export class AcopiadoresPage {
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly unidadesApi = inject(UnidadesApi);
  private readonly zonasApi = inject(ZonasApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  /** Solo la página visible de usuarios con rol ACOPIADOR (filtrado y paginado en el servidor). */
  private readonly usuarios = signal<UsuarioResponse[]>([]);
  protected readonly pagina = signal(0);
  protected readonly totalElementos = signal(0);
  protected readonly totalPaginas = signal(0);
  private peticion?: Subscription;
  private readonly unidades = signal<UnidadResponse[]>([]);
  private readonly zonas = signal<ZonaResponse[]>([]);

  protected readonly zonaPorId = computed(() => new Map(this.zonas().map((z) => [z.id, z.nombre])));

  protected readonly acopiadores = computed<AcopiadorConUnidades[]>(() =>
    this.usuarios()
      .map((usuario) => ({
        usuario,
        unidades: this.unidades().filter((unidad) => unidad.responsableId === usuario.id)
      }))
  );

  constructor() {
    this.cargar();
  }

  protected nombreZona(zonaId: string | null): string {
    if (!zonaId) return 'Sin zona';
    return this.zonaPorId().get(zonaId) ?? 'Zona no encontrada';
  }

  /** Recarga completa (zonas, flota y la página actual de acopiadores): carga inicial, reintento y tras cambios. */
  protected cargar(): void {
    this.zonasApi.listarAdmin().subscribe({ next: (z) => this.zonas.set(z), error: () => undefined });
    this.unidadesApi.listar().subscribe({ next: (u) => this.unidades.set(u), error: () => undefined });
    this.cargarAcopiadores();
  }

  /** Solo la página de acopiadores (rol=ACOPIADOR, filtrado y paginado en el servidor). */
  private cargarAcopiadores(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.peticion?.unsubscribe();
    this.peticion = this.usuariosApi
      .listarPaginado({ page: this.pagina(), size: TAMANO_PAGINA_ACOPIADORES, rol: 'ACOPIADOR' })
      .subscribe({
        next: (respuesta) => {
          const corregida = paginaCorregida(respuesta);
          if (corregida !== null) {
            this.pagina.set(corregida);
            this.cargarAcopiadores();
            return;
          }
          this.usuarios.set(respuesta.contenido);
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

  protected irAPagina(pagina: number): void {
    if (pagina < 0 || pagina >= this.totalPaginas()) return;
    this.pagina.set(pagina);
    this.cargarAcopiadores();
  }

  protected nuevoAcopiador(): void {
    const ref = this.dialog.open<NuevoAcopiadorResultado | undefined>(NuevoAcopiadorDialog, {
      ariaLabel: 'Nuevo acopiador'
    });
    ref.closed.subscribe((resultado) => {
      if (!resultado) return;
      this.toast.exito(
        resultado.unidad
          ? `Acopiador "${resultado.usuario.nombre}" creado con unidad ${resultado.unidad.placa}.`
          : `Acopiador "${resultado.usuario.nombre}" creado. Puedes asignarle una unidad desde aquí cuando quieras.`
      );
      this.cargar();
    });
  }

  /**
   * Sin navegar a otra pantalla. Primero pregunta "existente vs. nueva" (AsignarUnidadDialog, con el
   * combo de la flota actual) porque lo por-defecto al asignarle una unidad a un acopiador es darle una
   * YA existente; solo si el usuario contesta que es nueva se encadena UnidadFormDialog (creación) con
   * el responsable ya preseleccionado.
   */
  protected asignarUnidad(usuario: UsuarioResponse): void {
    const ref = this.dialog.open<AsignarUnidadResultado | undefined>(AsignarUnidadDialog, {
      ariaLabel: 'Asignar unidad',
      data: { unidades: this.unidades(), responsableId: usuario.id, responsableNombre: usuario.nombre }
    });
    ref.closed.subscribe((resultado) => {
      if (!resultado) return;
      if (resultado.tipo === 'reasignada') {
        this.toast.exito(`Unidad "${resultado.unidad.placa}" asignada a ${usuario.nombre}.`);
        this.cargar();
        return;
      }
      this.abrirFormularioNuevaUnidad(usuario);
    });
  }

  /**
   * El selector de responsable necesita TODOS los acopiadores activos, no solo la página visible: se pide la
   * lista completa (GET /admin/usuarios, pensada para selectores) solo en el momento de abrir el formulario.
   */
  private abrirFormularioNuevaUnidad(usuario: UsuarioResponse): void {
    this.usuariosApi.listar().subscribe({
      next: (todos) => {
        const responsablesActivos = todos.filter((u) => u.rolNombre === 'ACOPIADOR' && u.activo);
        const ref = this.dialog.open<UnidadResponse | undefined>(UnidadFormDialog, {
          ariaLabel: 'Nueva unidad',
          data: { responsables: responsablesActivos, responsableIdInicial: usuario.id }
        });
        ref.closed.subscribe((unidad) => {
          if (!unidad) return;
          this.toast.exito(`Unidad "${unidad.placa}" creada y asignada a ${usuario.nombre}.`);
          this.cargar();
        });
      },
      error: (error) => this.toast.error(mapHttpError(error).mensaje)
    });
  }

  protected editar(usuario: UsuarioResponse): void {
    const ref = this.dialog.open<UsuarioResponse | undefined>(UsuarioFormDialog, {
      ariaLabel: 'Editar acopiador',
      data: { roles: [], usuario, rolFijo: 'ACOPIADOR' as const }
    });
    ref.closed.subscribe((actualizado) => {
      if (actualizado) {
        this.toast.exito(`Acopiador "${actualizado.nombre}" actualizado.`);
        this.cargar();
      }
    });
  }

  protected alternarEstado(usuario: UsuarioResponse): void {
    const activar = !usuario.activo;
    const ref = this.dialog.open<boolean>(ConfirmDialog, {
      ariaLabel: activar ? 'Reactivar acopiador' : 'Desactivar acopiador',
      data: {
        titulo: activar ? 'Reactivar acopiador' : 'Desactivar acopiador',
        mensaje: activar
          ? `"${usuario.nombre}" volverá a poder iniciar sesión.`
          : `"${usuario.nombre}" no podrá iniciar sesión hasta reactivarlo. Sus unidades asignadas no cambian.`,
        etiquetaConfirmar: activar ? 'Reactivar' : 'Desactivar',
        peligroso: !activar
      }
    });
    ref.closed.subscribe((confirmado) => {
      if (!confirmado) return;
      const peticion: Observable<unknown> = activar
        ? this.usuariosApi.reactivar(usuario.id)
        : this.usuariosApi.desactivar(usuario.id);
      peticion.subscribe({
        next: () => {
          this.toast.exito(activar ? 'Acopiador reactivado.' : 'Acopiador desactivado.');
          this.cargar();
        },
        error: (error) => this.toast.error(mapHttpError(error).mensaje)
      });
    });
  }
}
