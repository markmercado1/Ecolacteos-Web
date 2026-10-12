import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITIO } from '../../config/sitio.config';
import { ProductoCatalogo } from '../../core/api/catalogo.models';
import { CatalogoStore } from '../../core/state/catalogo.store';
import { EstadoCargaComponent } from '../../shared/estado-carga';
import { disponibilidadDe } from '../../shared/formato';
import { CarruselProductosComponent } from '../../shared/carrusel-productos';

/**
 * Portada. Combina lo mejor de las referencias: encabezado limpio (Conga), tarjetas de producto sobre fondo suave (Bonle),
 * catálogo comercial con disponibilidad y precios visibles (Organa) y un carrusel de tarjetas en la portada. Todo producto, foto,
 * precio y disponibilidad sale del catálogo real del backend.
 */
@Component({
  selector: 'pub-inicio',
  imports: [RouterLink, EstadoCargaComponent, CarruselProductosComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inicio.html',
  styleUrl: './inicio.css'
})
export class InicioPage {
  protected readonly catalogo = inject(CatalogoStore);
  protected readonly sitio = SITIO;

  /** Productos que se pueden reservar hoy para el carrusel de la portada; primero los que tienen foto (hasta 8). */
  protected readonly destacados = computed<ProductoCatalogo[]>(() => {
    const reservables = this.catalogo.productos().filter((p) => disponibilidadDe(p) !== 'AGOTADO');
    const conFoto = reservables.filter((p) => !!p.fotoUrl || p.presentaciones.some((x) => !!x.fotoUrl));
    const sinFoto = reservables.filter((p) => !conFoto.includes(p));
    return [...conFoto, ...sinFoto].slice(0, 8);
  });

  protected readonly ventajas = [
    { titulo: 'Disponibilidad al día', texto: 'Lo que ves está calculado con el inventario real.' },
    { titulo: 'Sin pagos en línea', texto: 'Reservas sin tarjeta: solo registras tu solicitud.' },
    { titulo: 'Tú eliges la fecha', texto: 'Escoge entre las fechas de retiro disponibles.' },
    { titulo: 'Seguimiento con código', texto: 'Consulta el estado de tu reserva cuando quieras.' }
  ];

  protected readonly pasos = [
    { n: 1, titulo: 'Elige tus productos', texto: 'Explora el catálogo y agrega las presentaciones que quieras con su cantidad.' },
    { n: 2, titulo: 'Escoge la fecha de retiro', texto: 'Verás solo las fechas en las que podemos atenderte.' },
    { n: 3, titulo: 'Recibe tu código', texto: 'Guárdalo: con él y tu teléfono consultas el estado de tu reserva.' }
  ];

  constructor() {
    this.catalogo.cargar();
  }
}
