import { Disponibilidad, PresentacionCatalogo, ProductoCatalogo } from '../core/api/catalogo.models';
import { EstadoReserva } from '../core/api/reservas.models';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** «2026-10-13» → «martes 13 de octubre» (sin conversiones de zona horaria: es una fecha de calendario). */
export function formatearFecha(iso: string, conAnio = false): string {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!a || !m || !d) return iso;
  const dia = DIAS[new Date(a, m - 1, d).getDay()];
  return `${dia} ${d} de ${MESES[m - 1]}${conAnio ? ` de ${a}` : ''}`;
}

/** Misma fecha con la primera letra en mayúscula (para botones y resúmenes): «Martes 13 de octubre». */
export function fechaTitulo(iso: string, conAnio = false): string {
  const texto = formatearFecha(iso, conAnio);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** «2026-10-12T09:30:00» → «12/10/2026 09:30» (hora de Lima tal como la informa el servidor). */
export function formatearFechaHora(iso: string): string {
  const [fecha, hora = ''] = iso.split('T');
  const [a, m, d] = fecha.split('-');
  return `${d}/${m}/${a}${hora ? ' ' + hora.slice(0, 5) : ''}`;
}

export function formatearPrecio(valor: number): string {
  return `S/ ${valor.toFixed(2)}`;
}

export const ETIQUETA_DISPONIBILIDAD: Record<Disponibilidad, string> = {
  DISPONIBLE: 'Disponible',
  POCAS_UNIDADES: 'Pocas unidades',
  AGOTADO: 'Agotado'
};

export const ETIQUETA_ESTADO: Record<EstadoReserva, string> = {
  PENDIENTE: 'Pendiente de confirmación',
  CONFIRMADA: 'Confirmada',
  RECHAZADA: 'No aceptada',
  CANCELADA: 'Cancelada',
  VENCIDA: 'Vencida',
  RETIRADA: 'Retirada'
};

/** «Quedan 3 unidades» / «Queda 1 unidad»; null si el catálogo no informa cuántas quedan. */
export function textoQuedan(unidades: number | null): string | null {
  if (unidades === null) return null;
  return unidades === 1 ? 'Queda 1 unidad' : `Quedan ${unidades} unidades`;
}

/** Etiqueta de la disponibilidad de UNA presentación: con pocas unidades dice cuántas quedan. */
export function etiquetaDePresentacion(p: PresentacionCatalogo): string {
  return (p.disponibilidad === 'POCAS_UNIDADES' ? textoQuedan(p.unidadesDisponibles) : null) ?? ETIQUETA_DISPONIBILIDAD[p.disponibilidad];
}

/** Etiqueta del producto en la tarjeta: con una sola presentación y pocas unidades dice cuántas quedan; si no, el estado general. */
export function etiquetaDeProducto(producto: ProductoCatalogo): string {
  if (producto.presentaciones.length === 1) return etiquetaDePresentacion(producto.presentaciones[0]);
  return ETIQUETA_DISPONIBILIDAD[disponibilidadDe(producto)];
}

/** La mejor disponibilidad entre las presentaciones del producto (si alguna se puede reservar, el producto se puede reservar). */
export function disponibilidadDe(producto: ProductoCatalogo): Disponibilidad {
  const estados = producto.presentaciones.map((p) => p.disponibilidad);
  if (estados.includes('DISPONIBLE')) return 'DISPONIBLE';
  if (estados.includes('POCAS_UNIDADES')) return 'POCAS_UNIDADES';
  return 'AGOTADO';
}

/** Menor precio publicado entre las presentaciones, o null si ninguna tiene precio («Precio a confirmar»). */
export function precioDesde(producto: ProductoCatalogo): number | null {
  const precios = producto.presentaciones.map((p) => p.precio).filter((p): p is number => p !== null);
  return precios.length ? Math.min(...precios) : null;
}

const UNIDAD_CONTENIDO: Record<string, string> = { ML: 'ml', L: 'L', G: 'g', KG: 'kg' };

/** «1 L», «500 g»… si el catálogo informa el contenido; si no, solo la unidad de conteo. */
export function contenidoDe(p: PresentacionCatalogo): string {
  if (p.contenidoCantidad === null || !p.contenidoUnidad) return p.unidadConteo;
  return `${p.contenidoCantidad} ${UNIDAD_CONTENIDO[p.contenidoUnidad.toUpperCase()] ?? p.contenidoUnidad}`;
}

/** El contenido solo se muestra aparte si el nombre de la presentación no lo dice ya («Botella 1 L» no repite «1 L»). */
export function contenidoAparte(p: PresentacionCatalogo): string {
  const contenido = contenidoDe(p);
  const quitar = (t: string) => t.toLowerCase().replace(/\s+/g, '');
  return quitar(p.nombre).includes(quitar(contenido)) ? '' : contenido;
}
