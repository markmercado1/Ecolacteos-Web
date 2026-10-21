import { pagoAjustado, totalDePago } from './pago.models';

describe('totalDePago (vista previa del ajuste de precio)', () => {
  it('100 L: S/ 1.00 → S/ 100.00 y S/ 1.20 → S/ 120.00 (el ejemplo del negocio)', () => {
    expect(totalDePago(100, 1)).toBe(100);
    expect(totalDePago(100, 1.2)).toBe(120);
    expect(totalDePago(123, 1.2)).toBe(147.6);
  });

  it('redondea a céntimos half-up igual que el servidor, sin errores de coma flotante', () => {
    expect(totalDePago(123, 1.255)).toBe(154.37); // 154.365 → 154.37 (con floats daría 154.36)
    expect(totalDePago(10, 1.005)).toBe(10.05);
    expect(totalDePago(0.5, 0.001)).toBe(0); // 0.0005 → 0.00
    expect(totalDePago(0.5, 0.003)).toBe(0); // 0.0015 → 0.00 (0.0015 en céntimos es 0.15)
  });

  it('litros con decimales', () => {
    expect(totalDePago(78.5, 1)).toBe(78.5);
    expect(totalDePago(586.86, 1.2)).toBe(704.23); // 704.232 → 704.23
  });
});

describe('pagoAjustado', () => {
  it('es true solo si el precio efectivo difiere del original', () => {
    expect(pagoAjustado({ precioLitro: 1, precioLitroEfectivo: 1 })).toBe(false);
    expect(pagoAjustado({ precioLitro: 1, precioLitroEfectivo: 1.2 })).toBe(true);
  });
});
