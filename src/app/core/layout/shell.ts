import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { Dialog } from '@angular/cdk/dialog';
import { AuthService } from '../auth/auth.service';
import { ChangePasswordDialog } from '../../features/auth/ui/change-password-dialog/change-password-dialog';
import { IconComponent } from '../../shared/ui/icon/icon';
import { GRUPOS_NAVEGACION } from './nav-items';

/** "/produccion" coincide con "/produccion" y "/produccion?x", pero NO con "/produccion-diaria". */
export function coincideRuta(url: string, ruta: string): boolean {
  return url === ruta || url.startsWith(ruta + '/') || url.startsWith(ruta + '?') || url.startsWith(ruta + '#');
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.css'
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);

  protected readonly usuario = this.auth.usuario;
  protected readonly menuAbierto = signal(false);

  private readonly urlActual = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  protected readonly grupos = computed(() => {
    const rol = this.usuario()?.rolNombre;
    return GRUPOS_NAVEGACION
      .map((grupo) => ({
        ...grupo,
        items: grupo.items.filter((item) => !rol || item.roles.includes(rol))
      }))
      .filter((grupo) => grupo.items.length > 0);
  });

  // --- Secciones desplegables ---
  // Al entrar a una página queda abierta únicamente su sección y las demás, plegadas (así el menú se mantiene corto).
  // Mientras se está en esa página, el usuario puede abrir o cerrar otras a mano para explorar; al navegar de nuevo
  // se vuelve a abrir solo la de la página actual. No se recuerda nada entre visitas.
  protected readonly abiertos = signal<ReadonlySet<string>>(new Set());

  /** Id de la sección que contiene la ruta actual (la que se resalta aunque esté plegada). */
  protected readonly grupoActivo = computed(() => {
    const url = this.urlActual();
    return this.grupos().find((g) => g.items.some((i) => coincideRuta(url, i.ruta)))?.id ?? null;
  });

  // Depende de la URL (no solo del grupo): navegar entre páginas del mismo grupo también pliega lo que se abrió a mano.
  private readonly abrirSoloGrupoActivo = effect(() => {
    this.urlActual();
    const activo = this.grupoActivo();
    untracked(() => this.abiertos.set(activo ? new Set([activo]) : new Set()));
  });

  protected estaAbierto(id: string): boolean {
    return this.abiertos().has(id);
  }

  protected alternarGrupo(id: string): void {
    const siguiente = new Set(this.abiertos());
    if (!siguiente.delete(id)) siguiente.add(id);
    this.abiertos.set(siguiente);
  }

  protected readonly tituloActual = computed(() => {
    const url = this.urlActual();
    for (const grupo of this.grupos()) {
      const item = grupo.items.find((i) => coincideRuta(url, i.ruta));
      if (item) return item.etiqueta;
    }
    return 'Centro de gestión';
  });

  protected readonly iniciales = computed(() => {
    const nombre = this.usuario()?.nombre ?? '';
    return nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase())
      .join('') || '—';
  });

  alternarMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  abrirCambiarPassword(): void {
    this.dialog.open(ChangePasswordDialog, {
      ariaLabel: 'Cambiar contraseña',
      role: 'dialog'
    });
  }

  cerrarSesion(): void {
    this.auth.logout();
  }
}
