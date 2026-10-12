import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { SITIO, enlaceWhatsapp } from './config/sitio.config';
import { CarritoStore } from './core/state/carrito.store';

const DESCRIPCION_POR_DEFECTO = SITIO.descripcionCorta;

/**
 * Estructura común de la web pública: enlace de salto, franja informativa, encabezado con navegación, pie y botón flotante de
 * WhatsApp (solo si hay un número configurado). No tiene nada del panel interno: ni sesión, ni menú, ni token.
 */
@Component({
  selector: 'pub-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  protected readonly carrito = inject(CarritoStore);

  protected readonly sitio = SITIO;
  protected readonly anio = new Date().getFullYear();
  protected readonly menuAbierto = signal(false);
  protected readonly whatsapp = computed(() => enlaceWhatsapp('Hola, quisiera información sobre sus productos.'));
  protected readonly redes = Object.entries(SITIO.contacto.redes).filter(([, url]) => !!url) as [string, string][];

  protected readonly enlaces = [
    { ruta: '/', etiqueta: 'Inicio', exacto: true },
    { ruta: '/catalogo', etiqueta: 'Catálogo', exacto: false },
    { ruta: '/quienes-somos', etiqueta: 'Quiénes somos', exacto: false },
    { ruta: '/preguntas-frecuentes', etiqueta: 'Preguntas frecuentes', exacto: false },
    { ruta: '/contacto', etiqueta: 'Contacto', exacto: false }
  ];

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => {
        this.menuAbierto.set(false);
        let ruta = this.router.routerState.snapshot.root;
        while (ruta.firstChild) ruta = ruta.firstChild;
        this.meta.updateTag({ name: 'description', content: (ruta.data['descripcion'] as string | undefined) ?? DESCRIPCION_POR_DEFECTO });
      });
  }

  protected alternarMenu(): void {
    this.menuAbierto.update((v) => !v);
  }
}
