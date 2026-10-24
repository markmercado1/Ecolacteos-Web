import { documentoResumen, dniValido, limpiarDocumento, problemaDocumentos, rucValido } from './documentos';

describe('documentos del proveedor (Fase G)', () => {
  it('valida el dígito verificador del RUC igual que el servidor', () => {
    expect(rucValido('20131312955')).toBe(true); // RUC publicado de SUNAT
    expect(rucValido('20131312954')).toBe(false);
    expect(rucValido('10045678909')).toBe(true);
    expect(rucValido('10876543210')).toBe(true);
    expect(rucValido('2013131295')).toBe(false);
    expect(rucValido(null)).toBe(false);
  });

  it('el DNI son exactamente 8 dígitos y limpiar quita espacios, guiones y puntos', () => {
    expect(dniValido('04567890')).toBe(true);
    expect(dniValido('4567890')).toBe(false);
    expect(limpiarDocumento(' 10-04567890-9 ')).toBe('10045678909');
    expect(limpiarDocumento('  ')).toBeNull();
  });

  it('persona natural: DNI obligatorio y RUC opcional que debe ser 10 + su DNI', () => {
    expect(problemaDocumentos('NATURAL', null, null, null)).toContain('DNI es obligatorio');
    expect(problemaDocumentos('NATURAL', '123', null, null)).toContain('8 dígitos');
    expect(problemaDocumentos('NATURAL', '04567890', null, null)).toBeNull();
    expect(problemaDocumentos('NATURAL', '04567890', '10045678909', null)).toBeNull();
    expect(problemaDocumentos('NATURAL', '11111111', '10045678909', null)).toContain('10 + su DNI');
    expect(problemaDocumentos('NATURAL', '04567890', '20601234565', null)).toContain('empieza con 10');
    expect(problemaDocumentos('NATURAL', '04567890', '10045678900', null)).toContain('dígito verificador');
  });

  it('un DNI anterior fuera de formato que no cambia no se revalida', () => {
    expect(problemaDocumentos('NATURAL', '123 45', null, null, true)).toBeNull();
    expect(problemaDocumentos('NATURAL', '123 45', null, null, false)).toContain('8 dígitos');
  });

  it('empresa: RUC 20 y razón social obligatorios', () => {
    expect(problemaDocumentos('EMPRESA', null, null, 'ACME')).toContain('RUC es obligatorio');
    expect(problemaDocumentos('EMPRESA', null, '10045678909', 'ACME')).toContain('empieza con 20');
    expect(problemaDocumentos('EMPRESA', null, '20601234565', ' ')).toContain('razón social');
    expect(problemaDocumentos('EMPRESA', null, '20601234565', 'ACME S.A.C.')).toBeNull();
  });

  it('resume el documento para la tabla', () => {
    expect(documentoResumen({ dni: '04567890', ruc: null })).toBe('DNI 04567890');
    expect(documentoResumen({ dni: '04567890', ruc: '10045678909' })).toBe('DNI 04567890 · RUC 10045678909');
    expect(documentoResumen({ dni: null, ruc: '20601234565' })).toBe('RUC 20601234565');
  });
});
