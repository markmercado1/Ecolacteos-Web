# Clientes, compradores e historial de compras (Fase H)

Rama `feature/clientes-compradores` (backend y panel), creada desde `integration/7-fases`. **Sin merge ni push**: pendiente de revisión.

## Qué hace

- **Comprador de cada venta** (opcional): una ficha de **cliente** (padrón voluntario) o la ficha de **proveedor** (un proveedor que compra
  nunca se duplica como cliente). Sin comprador = «Cliente varios», como hasta ahora.
- **Reglas por canal** (panel): PÚBLICO comprador opcional; MAYORISTA exige un cliente que **ADMIN habilitó** como mayorista; PROVEEDOR exige
  un proveedor del padrón. El canal sigue decidiendo el precio; registrarse no da descuentos. Al elegir un proveedor se propone PROVEEDOR (puede
  comprar también a PÚBLICO); a cualquier otro comprador, PÚBLICO.
- **App móvil sin cambios**: sigue enviando ventas sin comprador en cualquier canal (las reglas de comprador son solo del panel).
- **Reservas**: el personal puede confirmar quién es el comprador de una reserva (cliente o proveedor existente). Al retirar, la venta usa ese
  comprador sin volver a pedir datos; si no hay comprador confirmado, la venta guarda solo el nombre dado al reservar y **no se crea ninguna
  ficha**. Controles de retiro (precio cotizado, cantidades, estados, retiro parcial) sin cambios.
- **Registro voluntario** (ADMIN y VENTAS): nombre y teléfono (correo, DNI y RUC opcionales), con lectura del aviso y **autorización del
  comprador**. Las **promociones** son una autorización aparte, opcional, nunca marcada por defecto, con medios (WhatsApp, SMS, llamada,
  correo), evidencia (quién, cuándo, cómo, versión del aviso) y **revocación** con un clic.
- **Identidad sin duplicados**: el teléfono solo **sugiere** (varias fichas pueden compartirlo; al registrar con un teléfono ya usado, el
  trabajador confirma si es esa persona o es otra). DNI/RUC exactos identifican con certeza; un DNI/RUC de proveedor no puede ser de un cliente.
  **Nada se fusiona solo**: la fusión es manual (ADMIN), con motivo y constancia.
- **Historial**: ficha del cliente con compras (fecha, canal, productos, cantidades, total, reserva de origen), reservas, número de compras,
  monto total y del **año calendario en curso (America/Lima)**, última compra y compras desde reserva. El historial consolidado del proveedor
  suma la sección «Compras» (solo ADMIN). Las ventas anónimas siguen en los totales generales, pero no se atribuyen a nadie.

## Pantallas del panel

- **Comercial → Clientes** (`/clientes`, ADMIN y VENTAS): padrón con búsqueda, filtros (activos, mayoristas, con promociones, desactivados) y
  ficha. VENTAS ve teléfonos, DNI, RUC y correo **ocultos** salvo los últimos dígitos (para confirmar con el comprador); ADMIN los ve completos.
- **Registrar venta**: bloque «Comprador» (buscar por nombre, teléfono, DNI o RUC; registrar cliente nuevo; Cliente varios); los canales que el
  comprador no admite aparecen deshabilitados con el motivo.
- **Detalle de reserva**: bloque «Comprador» (identificar, registrar con los datos de la reserva, quitar) mientras está pendiente o confirmada.
- **Detalle de venta**: comprador (o «Cliente varios») y reserva de origen.

## Datos personales (Ley 29733 y DS 016-2024-JUS)

Revisado contra el texto oficial del reglamento (arts. 1–10, 26, 42, 69) y de la ley (art. 14):

| Tratamiento | Base | Qué se implementó |
|---|---|---|
| Reserva web y compra | Relación contractual (Ley art. 14.5): no requiere consentimiento, sí el deber de informar (reglamento art. 6.1) | Aviso «Cómo usamos tus datos» en el formulario de reserva; se guarda la versión del aviso mostrada |
| Registro como cliente | Finalidad adicional: consentimiento libre, previo, expreso e informado (arts. 2–6); verbal en persona vale (art. 5.1.1); la prueba es del responsable (art. 9) | Aviso para leer al comprador; casilla de autorización obligatoria para crear la ficha; evidencia append-only |
| Promociones | Consentimiento directo y separado (art. 26.1); negarse o revocar gratis, sin más complejidad que otorgarlo, atendido en ≤ 10 días (arts. 10, 26.5) | Pregunta aparte, nunca marcada; medios; revocación inmediata desde la ficha; filtro «con promociones» para no contactar a nadie más |

**Pendiente del negocio (no se inventó):** el aviso exige datos del **responsable** que no están en el sistema. Se configuran en el backend
(`app.privacidad.*` / variables `PRIVACIDAD_*`) y, mientras falten, `GET /api/catalogo/privacidad` responde `completo: false` con la lista de
`faltantes`, el panel lo advierte al registrar y cada autorización guarda si el aviso estaba completo:

1. Razón social, RUC y domicilio del responsable del tratamiento.
2. Canal para ejercer derechos (ARCO) y revocar (correo o teléfono).
3. **Inscripción del banco de datos** en el Registro Nacional de Protección de Datos Personales (art. 42) y su nombre.
4. Destinatarios o encargados con acceso (por ejemplo, el proveedor de alojamiento) y si hay **transferencia internacional** (servidores fuera
   del Perú).
5. Plazos de conservación de reservas y fichas de clientes.
6. Procedimiento para **cancelar** (suprimir) una ficha a pedido del titular: no se implementó porque implica decidir qué se conserva por
   obligaciones contables; hoy se puede **desactivar** la ficha y revocar las promociones.

Estos textos son una propuesta técnica basada en la norma, **no** garantizan cumplimiento legal: conviene revisarlos con un especialista antes
de publicarlos.

## Decisiones técnicas

- **Copia histórica** en la venta: nombre del comprador y RUC si lo tenía (no se copia el DNI). Editar la ficha no cambia ventas pasadas.
- **Reserva → venta**: la venta guarda `reserva_id` (antes solo existía `reserva.venta_id`); la migración enlaza las ventas de retiros
  anteriores sin crear fichas ni cambiar importes.
- **Fusión**: mueve ventas y reservas del origen al destino, agrega teléfonos, copia DNI/RUC/correo solo si el destino no los tiene; se rechaza
  si los DNI o RUC difieren o si una es persona natural y la otra empresa; el origen queda inactivo apuntando al destino; las autorizaciones no
  se transfieren (son decisiones de esa ficha) y la condición de mayorista del destino no cambia.
- **Ficha desactivada**: no se usa en ventas nuevas (el retiro de una reserva ya vinculada sí se permite, para no bloquear la entrega).
- **Proveedor desactivado**: no se usa como comprador en ventas nuevas (mismo criterio).
- **Sugerencias por POST** para no dejar teléfonos ni documentos en URLs ni en registros de acceso.
- La autorización de promociones registrada desde la ficha usa la forma «de palabra, en persona».

## Fuera de alcance

Crédito y cuentas por cobrar, descuentos de compras en liquidaciones de leche, puntos, fidelidad, cupones, descuentos automáticos, facturación
electrónica, envío de promociones, cancelación (supresión) de fichas y cambios en la app móvil.
