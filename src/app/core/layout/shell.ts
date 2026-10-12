import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { Dialog } from '@angular/cdk/dialog';
import { AuthService } from '../auth/auth.service';
import { ChangePasswordDialog } from '../../features/auth/ui/change-password-dialog/change-password-dialog';
import { IconComponent } from '../../shared/ui/icon/icon';
import { GRUPOS_NAVEGACION } from './nav-items';

const CLAVE_ABIERTOS = 'ecolacteos.nav.seccionesAbiertas';

/** "/produccion" coincide con "/produccion" y "/produccion?x", pero NO con "/produccion-diaria". */
export function coincideRuta(url: string, ruta: string): boolean {
  return url === ruta || url.startsWith(ruta + '/') || url.startsWith(ruta + '?') || url.startsWith(ruta + '#');
}

function leerAbiertos(): ReadonlySet<string> {
  try {
    const valor = JSON.parse(localStorage.getItem(CLAVE_ABIERTOS) ?? '[]');
    return new Set(Array.isArray(valor) ? valor.filter((v) => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

function guardarAbiertos(abiertos: ReadonlySet<string>): void {
  try {
    localStorage.setItem(CLAVE_ABIERTOS, JSON.stringify([...abiertos]));
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): el menú sigue funcionando, solo no recuerda el estado.
  }
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
  // Abiertas: las que el usuario dejó abiertas (recordadas en este navegador) más, siempre, la sección de la
  // página actual al navegar. Recordarlo es solo una comodidad: si el almacenamiento no está disponible, el
  // menú funciona igual (abre la sección actual).
  protected readonly abiertos = signal<ReadonlySet<string>>(leerAbiertos());

  /** Id de la sección que contiene la ruta actual (la que se resalta aunque esté plegada). */
  protected readonly grupoActivo = computed(() => {
    const url = this.urlActual();
    return this.grupos().find((g) => g.items.some((i) => coincideRuta(url, i.ruta)))?.id ?? null;
  });

  private readonly abrirGrupoActivo = effect(() => {
    const activo = this.grupoActivo();
    if (activo) untracked(() => this.fijarAbierto(activo, true));
  });

  protected estaAbierto(id: string): boolean {
    return this.abiertos().has(id);
  }

  protected alternarGrupo(id: string): void {
    this.fijarAbierto(id, !this.abiertos().has(id));
  }

  private fijarAbierto(id: string, abierto: boolean): void {
    if (this.abiertos().has(id) === abierto) return;
    const siguiente = new Set(this.abiertos());
    if (abierto) siguiente.add(id);
    else siguiente.delete(id);
    this.abiertos.set(siguiente);
    guardarAbiertos(siguiente);
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
