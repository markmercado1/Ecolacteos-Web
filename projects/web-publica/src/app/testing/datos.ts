import { PresentacionCatalogo, ProductoCatalogo } from '../core/api/catalogo.models';
import { ReservaPublica } from '../core/api/reservas.models';

/** Datos de PRUEBA (solo para specs): nunca se importan desde código de la aplicación. */
export function presentacion(parcial: Partial<PresentacionCatalogo> = {}): PresentacionCatalogo {
  return {
    id: 'pr-1', nombre: 'Botella 1 L', contenidoCantidad: 1, contenidoUnidad: 'L', unidadConteo: 'botella', fotoUrl: null,
    precio: 8.5, precioAConfirmar: false, disponibilidad: 'DISPONIBLE', unidadesDisponibles: null, ...parcial
  };
}

export function producto(parcial: Partial<ProductoCatalogo> = {}): ProductoCatalogo {
  return { id: 'p-1', nombre: 'Yogurt Natural', familia: 'Yogures', fotoUrl: null, presentaciones: [presentacion()], ...parcial };
}

export function reserva(parcial: Partial<ReservaPublica> = {}): ReservaPublica {
  return {
    codigo: 'ABCD234567', estado: 'PENDIENTE', fechaRetiro: '2026-10-13', fechaMaximaRetiro: '2026-10-14', expiraEn: '2026-10-12T09:30:00',
    precioAConfirmar: false, total: 17,
    lineas: [{ presentacionId: 'pr-1', producto: 'Yogurt Natural', presentacion: 'Botella 1 L', unidadConteo: 'botella', cantidad: 2, precioUnitario: 8.5, subtotal: 17 }],
    ...parcial
  };
}
