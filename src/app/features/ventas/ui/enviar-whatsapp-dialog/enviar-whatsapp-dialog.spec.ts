import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { VentaResumenResponse } from '../../data-access/venta.models';
import { WhatsappService } from '../../data-access/whatsapp.service';
import { EnviarWhatsappDialog } from './enviar-whatsapp-dialog';

const venta: VentaResumenResponse = {
  id: 'v-1', fecha: '2026-10-30', tipoCliente: 'PUBLICO', total: 10.7, tipoComprobante: 'NOTA_VENTA', comprobante: 'NV01-00000041',
  detalles: [{ presentacionId: 'p1', presentacionNombre: 'Botella 1 L', productoNombre: 'Leche entera', cantidad: 2, precioUnitario: 4.5, subtotal: 9 }]
};

describe('EnviarWhatsappDialog', () => {
  let fixture: ComponentFixture<EnviarWhatsappDialog>;
  const dialogRef = { close: vi.fn() };
  const whatsapp = { numeroPropuesto: vi.fn(() => '51900000000'), abrir: vi.fn(() => true) };
  const raiz = () => fixture.nativeElement as HTMLElement;
  const numero = () => raiz().querySelector<HTMLInputElement>('#wa-numero')!;
  const mensaje = () => raiz().querySelector<HTMLTextAreaElement>('#wa-mensaje')!;
  const enviar = () => {
    raiz().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  };

  function escribir(el: HTMLInputElement | HTMLTextAreaElement, valor: string): void {
    el.value = valor;
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    dialogRef.close.mockReset();
    whatsapp.numeroPropuesto.mockReset().mockReturnValue('51900000000');
    whatsapp.abrir.mockReset().mockReturnValue(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: DialogRef, useValue: dialogRef },
        { provide: DIALOG_DATA, useValue: { venta } },
        { provide: WhatsappService, useValue: whatsapp }
      ]
    });
    fixture = TestBed.createComponent(EnviarWhatsappDialog);
    fixture.detectChanges();
  });

  it('propone el número recordado (o el ficticio) y un mensaje con el comprobante', () => {
    expect(numero().value).toBe('+51 900 000 000');
    expect(mensaje().value).toContain('Nota de venta NV01-00000041');
    expect(mensaje().value).toContain('• 2 × Leche entera (Botella 1 L): S/ 9.00');
    expect(mensaje().value).toContain('Total: S/ 10.70');
    expect(raiz().textContent).toContain('NV01-00000041 · S/ 10.70');
  });

  it('el número se puede cambiar en cada envío y se manda normalizado, con el mensaje (también editado)', () => {
    escribir(numero(), '987 654 321');
    escribir(mensaje(), 'Hola, tu pedido está listo');
    expect(raiz().querySelector('[data-testid="numero-ayuda"]')?.textContent).toContain('+51 987 654 321');

    enviar();

    expect(whatsapp.abrir).toHaveBeenCalledWith('51987654321', 'Hola, tu pedido está listo');
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('un número inválido no abre WhatsApp: avisa y deja el diálogo abierto', () => {
    escribir(numero(), '12345');
    expect(raiz().querySelector('[data-testid="numero-error"]')).toBeNull(); // no se reclama mientras se teclea

    enviar();

    expect(whatsapp.abrir).not.toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(raiz().querySelector('[data-testid="numero-error"]')?.textContent).toContain('móvil peruano');
    expect(numero().getAttribute('aria-invalid')).toBe('true');
  });

  it('si el navegador bloquea la ventana avisa y no cierra el diálogo', () => {
    const avisar = vi.spyOn(TestBed.inject(ToastService), 'error');
    whatsapp.abrir.mockReturnValue(false);
    enviar();
    expect(avisar).toHaveBeenCalledWith(expect.stringContaining('bloqueó'));
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('Cancelar cierra sin enviar', () => {
    (Array.from(raiz().querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Cancelar') as HTMLButtonElement).click();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
    expect(whatsapp.abrir).not.toHaveBeenCalled();
  });
});
