import { TestBed } from '@angular/core/testing';
import { BarChartComponent } from './bar-chart';

function crear() {
  return TestBed.createComponent(BarChartComponent);
}

describe('BarChartComponent', () => {
  it('muestra el estado vacío cuando no hay datos', () => {
    const f = crear();
    f.componentRef.setInput('titulo', 'Ventas por canal');
    f.componentRef.setInput('datos', []);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No hay datos para mostrar este gráfico.');
    expect(f.nativeElement.querySelector('.barras')).toBeNull();
  });

  it('normaliza el ancho de las barras contra el valor máximo', () => {
    const f = crear();
    f.componentRef.setInput('titulo', 'Ventas por canal');
    f.componentRef.setInput('unidad', 'S/');
    f.componentRef.setInput('datos', [
      { etiqueta: 'MAYORISTA', valor: 100 },
      { etiqueta: 'PROVEEDOR', valor: 50 },
      { etiqueta: 'PUBLICO', valor: 25 },
    ]);
    f.detectChanges();
    const rellenos = f.nativeElement.querySelectorAll('.relleno') as NodeListOf<HTMLElement>;
    expect(rellenos.length).toBe(3);
    expect(rellenos[0].style.width).toBe('100%');
    expect(rellenos[1].style.width).toBe('50%');
    expect(rellenos[2].style.width).toBe('25%');
    expect(f.nativeElement.textContent).toContain('100 S/');
  });

  it('un valor null se muestra como "Sin cálculo", nunca como 0 ni con una barra rellena', () => {
    const f = crear();
    f.componentRef.setInput('titulo', 'Rendimiento del lote');
    f.componentRef.setInput('datos', [
      { etiqueta: 'Obtenido', valor: null },
      { etiqueta: 'Esperado', valor: 15 },
    ]);
    f.detectChanges();
    const filas = f.nativeElement.querySelectorAll('.fila-barra');
    expect(filas[0].querySelector('.relleno')).toBeNull();
    expect(filas[0].textContent).toContain('Sin cálculo');
    expect(filas[0].textContent).not.toContain('0%');
    // La tabla accesible también refleja "Sin cálculo", no un 0.
    const tabla = f.nativeElement.querySelector('.tabla-accesible');
    expect(tabla.textContent).toContain('Sin cálculo');
  });

  it('serieUnica=true usa un solo color y no muestra leyenda', () => {
    const f = crear();
    f.componentRef.setInput('titulo', 'Acopio por proveedor');
    f.componentRef.setInput('serieUnica', true);
    f.componentRef.setInput('datos', [
      { etiqueta: 'Productor Uno', valor: 80 },
      { etiqueta: 'Productor Dos', valor: 40 },
    ]);
    f.detectChanges();
    expect(f.nativeElement.querySelector('.leyenda')).toBeNull();
    const rellenos = f.nativeElement.querySelectorAll('.relleno') as NodeListOf<HTMLElement>;
    expect(rellenos[0].style.background).toBe(rellenos[1].style.background);
  });

  it('con 2 o más series distintas muestra una leyenda con colores en orden fijo', () => {
    const f = crear();
    f.componentRef.setInput('titulo', 'Componentes del score');
    f.componentRef.setInput('datos', [
      { etiqueta: 'Calidad', valor: 90 },
      { etiqueta: 'Regularidad', valor: 70 },
      { etiqueta: 'Anomalías', valor: 100 },
    ]);
    f.detectChanges();
    const leyenda = f.nativeElement.querySelectorAll('.leyenda li');
    expect(leyenda.length).toBe(3);
    const rellenos = f.nativeElement.querySelectorAll('.relleno') as NodeListOf<HTMLElement>;
    expect(rellenos[0].style.background).toBe('var(--chart-1)');
    expect(rellenos[1].style.background).toBe('var(--chart-2)');
    expect(rellenos[2].style.background).toBe('var(--chart-3)');
  });

  it('la tabla accesible incluye los mismos datos que las barras', () => {
    const f = crear();
    f.componentRef.setInput('titulo', 'Campo vs planta');
    f.componentRef.setInput('unidad', 'L');
    f.componentRef.setInput('datos', [
      { etiqueta: 'Campo', valor: 120.5 },
      { etiqueta: 'Planta', valor: 118 },
    ]);
    f.detectChanges();
    const filasTabla = f.nativeElement.querySelectorAll('.tabla-accesible tbody tr');
    expect(filasTabla.length).toBe(2);
    expect(filasTabla[0].textContent).toContain('Campo');
    expect(filasTabla[0].textContent).toContain('120.5');
    expect(filasTabla[1].textContent).toContain('Planta');
    expect(filasTabla[1].textContent).toContain('118');
  });
});
