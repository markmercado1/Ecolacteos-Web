import { formatearFecha } from '../../../shared/util/fecha';
import { ETIQUETAS_COMPROBANTE, VentaResumenResponse } from '../data-access/venta.models';

/**
 * Texto que se propone al enviar el comprobante por WhatsApp: tipo y número, fecha, líneas y total. Es solo una propuesta: el vendedor lo
 * puede cambiar antes de abrir WhatsApp. El PDF no viaja en el enlace (wa.me solo lleva texto): se adjunta aparte con «Descargar PDF».
 */
export function mensajeComprobante(venta: VentaResumenResponse, empresa = 'EcoLácteos'): string {
  const tipo = venta.tipoComprobante ? ETIQUETAS_COMPROBANTE[venta.tipoComprobante] : 'Comprobante de venta';
  const comprobante = venta.comprobante ? ` ${venta.comprobante}` : '';
  const lineas = venta.detalles.map((l) => `• ${l.cantidad} × ${l.productoNombre} (${l.presentacionNombre}): S/ ${l.subtotal.toFixed(2)}`);
  return [
    `Hola, gracias por tu compra en ${empresa}.`,
    '',
    `${tipo}${comprobante}`,
    `Fecha: ${formatearFecha(venta.fecha)}`,
    ...lineas,
    '',
    `Total: S/ ${venta.total.toFixed(2)}`
  ].join('\n');
}
