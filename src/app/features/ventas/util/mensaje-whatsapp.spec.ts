import { VentaResumenResponse } from '../data-access/venta.models';
import { mensajeComprobante } from './mensaje-whatsapp';

const venta: VentaResumenResponse = {
  id: 'v-1', fecha: '2026-10-30', tipoCliente: 'PUBLICO', total: 37.62, tipoComprobante: 'BOLETA', comprobante: 'B001-00000213',
  detalles: [
    { presentacionId: 'p1', presentacionNombre: '1 L', productoNombre: 'Aceite vegetal', cantidad: 1, precioUnitario: 9.9, subtotal: 9.9 },
    { presentacionId: 'p2', presentacionNombre: '2.5 L', productoNombre: 'Agua mineral', cantidad: 7, precioUnitario: 3.96, subtotal: 27.72 }
  ]
};

describe('mensajeComprobante', () => {
  it('incluye el tipo y número, la fecha, cada línea y el total', () => {
    expect(mensajeComprobante(venta)).toBe(
      [
        'Hola, gracias por tu compra en EcoLácteos.',
        '',
        'Boleta de venta electrónica B001-00000213',
        'Fecha: 30/10/2026',
        '• 1 × Aceite vegetal (1 L): S/ 9.90',
        '• 7 × Agua mineral (2.5 L): S/ 27.72',
        '',
        'Total: S/ 37.62'
      ].join('\n')
    );
  });

  it('una venta sin comprobante (backend anterior) no deja huecos', () => {
    const texto = mensajeComprobante({ ...venta, tipoComprobante: null, comprobante: null }, 'Mi planta');
    expect(texto).toContain('compra en Mi planta');
    expect(texto).toContain('\nComprobante de venta\n');
  });
});
