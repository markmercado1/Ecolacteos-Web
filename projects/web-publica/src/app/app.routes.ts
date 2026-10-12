import { Routes } from '@angular/router';

const SITIO = 'EcoLácteos Huata';

export const routes: Routes = [
  {
    path: '',
    title: `${SITIO} · Catálogo y reservas en línea`,
    data: { descripcion: 'Conoce los productos lácteos de EcoLácteos Huata, consulta su disponibilidad y resérvalos para retirarlos en la fecha que elijas.' },
    loadComponent: () => import('./pages/inicio/inicio').then((m) => m.InicioPage)
  },
  {
    path: 'catalogo',
    title: `Catálogo · ${SITIO}`,
    data: { descripcion: 'Catálogo de productos con disponibilidad y precios actualizados. Elige tus productos y resérvalos en línea.' },
    loadComponent: () => import('./pages/catalogo/catalogo').then((m) => m.CatalogoPage)
  },
  {
    path: 'producto/:id',
    title: `Producto · ${SITIO}`,
    data: { descripcion: 'Presentaciones, precio y disponibilidad del producto. Agrégalo a tu reserva.' },
    loadComponent: () => import('./pages/producto/producto').then((m) => m.ProductoPage)
  },
  {
    path: 'reservar',
    title: `Reservar productos · ${SITIO}`,
    data: { descripcion: 'Reserva tus productos lácteos: elige las presentaciones, la fecha de retiro y deja tus datos. Recibirás un código de seguimiento.' },
    loadComponent: () => import('./pages/reservar/reservar').then((m) => m.ReservarPage)
  },
  {
    path: 'consultar-reserva',
    title: `Consultar mi reserva · ${SITIO}`,
    data: { descripcion: 'Consulta el estado de tu reserva con tu código de seguimiento y tu teléfono.' },
    loadComponent: () => import('./pages/consultar/consultar').then((m) => m.ConsultarPage)
  },
  {
    path: 'quienes-somos',
    title: `Quiénes somos · ${SITIO}`,
    data: { descripcion: 'Conoce a EcoLácteos Huata y cómo funcionan el catálogo y las reservas en línea.' },
    loadComponent: () => import('./pages/quienes-somos/quienes-somos').then((m) => m.QuienesSomosPage)
  },
  {
    path: 'contacto',
    title: `Contacto · ${SITIO}`,
    data: { descripcion: 'Formas de contacto, ubicación y horario de atención de EcoLácteos Huata.' },
    loadComponent: () => import('./pages/contacto/contacto').then((m) => m.ContactoPage)
  },
  {
    path: 'preguntas-frecuentes',
    title: `Preguntas frecuentes · ${SITIO}`,
    data: { descripcion: 'Respuestas sobre el catálogo, los precios, las reservas, la confirmación, el retiro y la consulta de tu pedido.' },
    loadComponent: () => import('./pages/faqs/faqs').then((m) => m.FaqsPage)
  },
  {
    path: '**',
    title: `Página no encontrada · ${SITIO}`,
    loadComponent: () => import('./pages/no-encontrada/no-encontrada').then((m) => m.NoEncontradaPage)
  }
];
