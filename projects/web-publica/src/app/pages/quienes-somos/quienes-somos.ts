import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITIO } from '../../config/sitio.config';

/** Los textos salen de config/sitio.config.ts (provisionales hasta recibir los oficiales); aquí solo hay estructura. */
@Component({
  selector: 'pub-quienes-somos',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-title">
      <div class="container">
        <h1>{{ sitio.quienesSomos.titulo }}</h1>
        <p>Conoce a {{ sitio.nombre }} y cómo funciona nuestra web.</p>
      </div>
    </section>

    <section class="section">
      <div class="container intro">
        <img src="/img/logo-ecolacteos.png" alt="Logotipo de {{ sitio.nombre }}" width="300" height="271" class="logo">
        <div>
          @for (p of sitio.quienesSomos.introduccion; track $index) { <p [class.lead]="$first">{{ p }}</p> }
          <div class="botones">
            <a routerLink="/catalogo" class="btn">Ver catálogo</a>
            <a routerLink="/contacto" class="btn btn-outline">Contacto</a>
          </div>
        </div>
      </div>
    </section>

    <section class="section section-sage">
      <div class="container">
        <div class="section-head center">
          <span class="eyebrow">Nuestra forma de atenderte</span>
          <h2>Pensada para que reservar sea fácil</h2>
        </div>
        <ul class="pilares">
          @for (p of sitio.quienesSomos.pilares; track p.titulo) {
            <li class="card card-pad">
              <h3>{{ p.titulo }}</h3>
              <p>{{ p.texto }}</p>
            </li>
          }
        </ul>
      </div>
    </section>
  `,
  styles: `
    .intro { display: grid; grid-template-columns: auto 1fr; gap: clamp(1.5rem, 5vw, 4rem); align-items: center; }
    .logo { width: min(100%, 18rem); height: auto; }
    .botones { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1.5rem; }
    .pilares { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: 1.25rem; }
    .pilares p { margin: 0; color: var(--color-muted); }
    @media (max-width: 720px) { .intro { grid-template-columns: 1fr; } .logo { width: 12rem; } }
  `
})
export class QuienesSomosPage {
  protected readonly sitio = SITIO;
}
