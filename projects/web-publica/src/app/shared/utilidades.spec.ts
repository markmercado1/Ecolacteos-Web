import { HttpErrorResponse } from '@angular/common/http';
import { enlaceWhatsapp, hayDatosDeContacto, SITIO } from '../config/sitio.config';
import { apiUrl, urlFoto } from '../core/api/api-url';
import { errorAmigable } from '../core/api/http-error';
import { presentacion, producto } from '../testing/datos';
import { contenidoAparte, contenidoDe, disponibilidadDe, etiquetaDePresentacion, etiquetaDeProducto, fechaTitulo, textoQuedan, formatearFecha, formatearFechaHora, formatearPrecio, precioDesde } from './formato';

describe('formato', () => {
  it('formatea fechas de calendario sin desfases de zona horaria', () => {
    expect(formatearFecha('2026-10-13')).toBe('martes 13 de octubre');
    expect(formatearFecha('2026-01-01', true)).toBe('jueves 1 de enero de 2026');
    expect(fechaTitulo('2026-10-12')).toBe('Lunes 12 de octubre');
    expect(formatearFechaHora('2026-10-12T09:30:00')).toBe('12/10/2026 09:30');
    expect(formatearPrecio(6.5)).toBe('S/ 6.50');
  });

  it('el contenido usa unidades legibles y no repite lo que ya dice el nombre', () => {
    expect(contenidoDe(presentacion({ contenidoCantidad: 500, contenidoUnidad: 'ML' }))).toBe('500 ml');
    expect(contenidoDe(presentacion({ contenidoCantidad: null, contenidoUnidad: null, unidadConteo: 'pieza' }))).toBe('pieza');
    expect(contenidoAparte(presentacion({ nombre: 'Botella 1 L', contenidoCantidad: 1, contenidoUnidad: 'L' }))).toBe('');
    expect(contenidoAparte(presentacion({ nombre: 'Familiar', contenidoCantidad: 2, contenidoUnidad: 'L' }))).toBe('2 L');
  });

  it('la disponibilidad y el precio del producto salen de sus presentaciones, sin inventar nada', () => {
    const p = producto({ presentaciones: [presentacion({ id: 'a', disponibilidad: 'AGOTADO', precio: 9 }), presentacion({ id: 'b', disponibilidad: 'POCAS_UNIDADES', precio: 7 }), presentacion({ id: 'c', precio: null, disponibilidad: 'AGOTADO' })] });
    expect(disponibilidadDe(p)).toBe('POCAS_UNIDADES');
    expect(precioDesde(p)).toBe(7);
    expect(disponibilidadDe(producto({ presentaciones: [presentacion({ disponibilidad: 'AGOTADO' })] }))).toBe('AGOTADO');
    expect(precioDesde(producto({ presentaciones: [presentacion({ precio: null })] }))).toBeNull();
  });
});

describe('cantidades que quedan', () => {
  it('con pocas unidades las etiquetas dicen cuántas quedan; en otro caso, solo el estado', () => {
    expect(textoQuedan(1)).toBe('Queda 1 unidad');
    expect(textoQuedan(3)).toBe('Quedan 3 unidades');
    expect(textoQuedan(null)).toBeNull();
    expect(etiquetaDePresentacion(presentacion({ disponibilidad: 'POCAS_UNIDADES', unidadesDisponibles: 2 }))).toBe('Quedan 2 unidades');
    expect(etiquetaDePresentacion(presentacion({ disponibilidad: 'POCAS_UNIDADES', unidadesDisponibles: null }))).toBe('Pocas unidades');
    expect(etiquetaDePresentacion(presentacion({ disponibilidad: 'DISPONIBLE' }))).toBe('Disponible');
    expect(etiquetaDePresentacion(presentacion({ disponibilidad: 'AGOTADO' }))).toBe('Agotado');
  });

  it('el producto muestra la cantidad solo si tiene una única presentación con pocas unidades', () => {
    const una = producto({ presentaciones: [presentacion({ disponibilidad: 'POCAS_UNIDADES', unidadesDisponibles: 4 })] });
    const varias = producto({ presentaciones: [presentacion({ id: 'a', disponibilidad: 'POCAS_UNIDADES', unidadesDisponibles: 4 }), presentacion({ id: 'b', disponibilidad: 'POCAS_UNIDADES', unidadesDisponibles: 1 })] });
    expect(etiquetaDeProducto(una)).toBe('Quedan 4 unidades');
    expect(etiquetaDeProducto(varias)).toBe('Pocas unidades');
  });
});

describe('api-url', () => {
  it('construye URLs de la API y resuelve las fotos relativas', () => {
    expect(apiUrl('/catalogo/productos')).toBe('/api/catalogo/productos');
    expect(urlFoto('/api/catalogo/fotos/x.png')).toBe('/api/catalogo/fotos/x.png');
    expect(urlFoto('https://cdn.ejemplo.pe/x.png')).toBe('https://cdn.ejemplo.pe/x.png');
    expect(urlFoto(null)).toBeNull();
  });
});

describe('errorAmigable', () => {
  const http = (status: number, cuerpo?: unknown) => new HttpErrorResponse({ status, error: cuerpo });

  it('traduce los errores del backend a mensajes comprensibles', () => {
    expect(errorAmigable(http(400, { mensaje: 'El teléfono no es válido.' }))).toMatchObject({ tipo: 'validacion', mensaje: 'El teléfono no es válido.', resultadoIncierto: false });
    expect(errorAmigable(http(409, { mensaje: 'Ya tienes 2 reservas pendientes.' }))).toMatchObject({ tipo: 'conflicto', mensaje: 'Ya tienes 2 reservas pendientes.' });
    expect(errorAmigable(http(404))).toMatchObject({ tipo: 'no-encontrado', resultadoIncierto: false });
    expect(errorAmigable(http(422, { mensaje: 'No disponible' }))).toMatchObject({ tipo: 'validacion' });
    expect(errorAmigable(http(403)).mensaje).toContain('acceso denegado'); // p. ej. rechazo de CORS: no es «error inesperado»
  });

  it('marca como incierto el resultado cuando no se sabe si el servidor procesó la solicitud', () => {
    expect(errorAmigable(http(0))).toMatchObject({ tipo: 'red', resultadoIncierto: true });
    expect(errorAmigable(http(503))).toMatchObject({ tipo: 'servidor', resultadoIncierto: true });
    expect(errorAmigable(new Error('x'))).toMatchObject({ resultadoIncierto: true });
  });
});

describe('configuración del sitio', () => {
  it('sin datos reales configurados no hay contacto ni WhatsApp (nada inventado)', () => {
    expect(hayDatosDeContacto()).toBe(false);
    expect(enlaceWhatsapp('hola')).toBeNull();
    expect(SITIO.contacto.whatsapp).toBe('');
  });

  it('con un número real genera el enlace de WhatsApp y con un dato de contacto se considera que hay contacto', () => {
    const c = { ...SITIO.contacto, whatsapp: '+51 999 888 777' };
    expect(enlaceWhatsapp('Hola, ¿qué tal?', c)).toBe('https://wa.me/51999888777?text=Hola%2C%20%C2%BFqu%C3%A9%20tal%3F');
    expect(enlaceWhatsapp('', c)).toBe('https://wa.me/51999888777');
    expect(hayDatosDeContacto({ ...SITIO.contacto, horario: 'Lunes a sábado' })).toBe(true);
  });
});
