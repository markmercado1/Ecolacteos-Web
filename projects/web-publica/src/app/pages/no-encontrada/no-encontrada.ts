import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'pub-no-encontrada',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section">
      <div class="container centro">
        <img src="/img/icono-vaca-192.png" alt="" width="96" height="96">
        <h1>No encontramos esa página</h1>
        <p class="lead">Es posible que el enlace esté incompleto o que la página ya no exista.</p>
        <div class="botones">
          <a routerLink="/" class="btn">Ir al inicio</a>
          <a routerLink="/catalogo" class="btn btn-outline">Ver el catálogo</a>
        </div>
      </div>
    </section>
  `,
  styles: `
    .centro { text-align: center; display: grid; justify-items: center; gap: 0.5rem; padding-block: 2rem; }
    .botones { display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center; margin-top: 1rem; }
  `
})
export class NoEncontradaPage {}
