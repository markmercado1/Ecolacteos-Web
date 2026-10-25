import { criterioDeBusqueda } from './cliente.models';

describe('criterioDeBusqueda (Fase H)', () => {
  it('reconoce teléfono, DNI y RUC por sus dígitos y busca por nombre en lo demás', () => {
    expect(criterioDeBusqueda('987 654 321')).toEqual({ telefono: '987654321' });
    expect(criterioDeBusqueda('+51 987-654-321')).toEqual({ telefono: '987654321' });
    expect(criterioDeBusqueda('04567890')).toEqual({ dni: '04567890' });
    expect(criterioDeBusqueda('20601234565')).toEqual({ ruc: '20601234565' });
    expect(criterioDeBusqueda('  Rosa Quispe ')).toEqual({ nombre: 'Rosa Quispe' });
    expect(criterioDeBusqueda('123')).toEqual({ nombre: '123' });
  });
});
