import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { Observable, Subscription } from 'rxjs';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { ConfirmDialog } from '../../../../shared/ui/dialog/confirm-dialog';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { paginaCorregida, TAMANOS_PAGINA, TAMANO_PAGINA_POR_DEFECTO } from '../../../../shared/util/paginacion';
import { RolResponse, UsuarioResponse } from '../../data-access/usuario.models';
import { UsuariosApi } from '../../data-access/usuarios.api';
import { UsuarioFormDialog } from '../../ui/usuario-form-dialog/usuario-form-dialog';

type FiltroEstado = 'TODOS' | 'ACTIVOS' | 'INACTIVOS';

@Component({
  selector: 'app-usuarios-page',
  imports: [DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './usuarios-page.html',
  styleUrl: './usuarios-page.css'
})
export class UsuariosPage {
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly usuarios = signal<UsuarioResponse[]>([]);
  protected readonly roles = signal<RolResponse[]>([]);

  /** Texto del buscador estándar (nombre o correo): se envía al servidor y busca entre todos los usuarios. */
  private readonly busquedaAplicada = signal('');
  protected readonly filtroRol = signal<string>('TODOS');
  protected readonly filtroEstado = signal<FiltroEstado>('TODOS');
  protected readonly pagina = signal(0);
  protected readonly tamano = signal(TAMANO_PAGINA_POR_DEFECTO);
  protected readonly tamanos = TAMANOS_PAGINA;
  protected readonly totalElementos = signal(0);
  protected readonly totalPaginas = signal(0);
  private peticion?: Subscription;

  protected readonly columnas: ColumnaTabla[] = [
    { clave: 'nombre', etiqueta: 'Nombre' },
    { clave: 'email', etiqueta: 'Correo de acceso' },
    { clave: 'rolNombre', etiqueta: 'Rol' },
    { clave: 'estado', etiqueta: 'Estado' },
    { clave: 'acciones', etiqueta: '' }
  ];

  constructor() {
    this.usuariosApi.listarRoles().subscribe({
      next: (roles) => this.roles.set(roles),
      error: () => undefined // el selector de rol del formulario puede quedar vacío; no bloquea el listado
    });
    this.cargar();
  }

  protected cargar(): void {
    this.peticion?.unsubscribe();
    this.cargando.set(true);
    this.error.set(null);
    const rol = this.filtroRol();
    const estado = this.filtroEstado();
    this.peticion = this.usuariosApi
      .listarPaginado({
        page: this.pagina(),
        size: this.tamano(),
        rol: rol === 'TODOS' ? undefined : rol,
        activo: estado === 'TODOS' ? undefined : estado === 'ACTIVOS',
        busqueda: this.busquedaAplicada() || undefined
      })
      .subscribe({
        next: (respuesta) => {
          const corregida = paginaCorregida(respuesta);
          if (corregida !== null) {
            this.pagina.set(corregida);
            this.cargar();
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

  protected buscar(texto: string): void {
    this.busquedaAplicada.set(texto);
    this.pagina.set(0);
    this.cargar();
  }

  protected cambiarFiltroRol(valor: string): void {
    this.filtroRol.set(valor);
    this.pagina.set(0);
    this.cargar();
  }

  protected cambiarFiltroEstado(valor: string): void {
    this.filtroEstado.set(valor as FiltroEstado);
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

  protected nuevoUsuario(): void {
    const ref = this.dialog.open<UsuarioResponse | undefined>(UsuarioFormDialog, {
      ariaLabel: 'Nuevo usuario',
      data: { roles: this.roles() }
    });
    ref.closed.subscribe((usuario) => {
      if (usuario) {
        this.toast.exito(`Usuario "${usuario.nombre}" creado.`);
        this.cargar();
      }
    });
  }

  protected editarUsuario(usuario: UsuarioResponse): void {
    const ref = this.dialog.open<UsuarioResponse | undefined>(UsuarioFormDialog, {
      ariaLabel: 'Editar usuario',
      data: { roles: this.roles(), usuario }
    });
    ref.closed.subscribe((actualizado) => {
      if (actualizado) {
        this.toast.exito(`Usuario "${actualizado.nombre}" actualizado.`);
        this.cargar();
      }
    });
  }

  protected alternarEstado(usuario: UsuarioResponse): void {
    const activar = !usuario.activo;
    const ref = this.dialog.open<boolean>(ConfirmDialog, {
      ariaLabel: activar ? 'Reactivar usuario' : 'Desactivar usuario',
      data: {
        titulo: activar ? 'Reactivar usuario' : 'Desactivar usuario',
        mensaje: activar
          ? `"${usuario.nombre}" volverá a poder iniciar sesión.`
          : `"${usuario.nombre}" no podrá iniciar sesión hasta reactivarlo. Esta acción no elimina su historial.`,
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
          this.toast.exito(activar ? 'Usuario reactivado.' : 'Usuario desactivado.');
          this.cargar();
        },
        error: (error) => this.toast.error(mapHttpError(error).mensaje)
      });
    });
  }
}
