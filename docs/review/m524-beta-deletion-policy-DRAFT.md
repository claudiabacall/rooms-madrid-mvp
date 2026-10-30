# ROOMS · M5.24 · Conservacion y bajas Beta 1.0

Fecha de preparacion: 30/10/2026

ESTADO: PROPUESTA PARA REVISION JURIDICA Y TECNICA.
NO APROBADA. NO PUBLICAR. NO AUTORIZA BAJAS REALES.

## 1. Alcance de la beta

- Beta privada, gratuita, exclusivamente por invitacion.
- Personas de 18 anos o mas.
- Sin pagos, reservas, fianzas o contratos gestionados por ROOMS.
- Las solicitudes de derechos se atienden manualmente.
- No afirmar que las bajas son automaticas.

## 2. Propuesta de tratamiento por categoria

| Categoria | Criterio propuesto | Pendiente |
| --- | --- | --- |
| Cuenta Auth y perfil | Suprimir al tramitar una baja procedente | Integracion y verificacion real |
| ROOMS DNA y preferencias | Suprimir los datos propios de la cuenta | Inventario completo |
| Anuncios y ubicaciones | Despublicar y eliminar datos propios | Dependencias y referencias |
| Fotos y Storage | Eliminar mediante API y comprobar tambien Storage DB | Barrera de escrituras real |
| Mensajes | No retener historial por defecto tras baja hasta aprobar tratamiento excepcional | Derechos de participantes, FK y respaldo juridico |
| Conexiones y guardados | Eliminar relaciones propias conforme al tratamiento aprobado | Dependencias |
| Comunidades y Hogares | Detener la baja hasta resolver titularidad y continuidad | Procedimiento de transferencia o cierre |
| Reportes y bloqueos | Evaluar conservacion minima justificada o supresion | Base juridica, acceso y plazo |
| Solicitudes de derechos | Mantener evidencia minima de gestion cuando corresponda | Datos, acceso y plazo |
| Auditoria administrativa | Separada de Auth y limitada a lo necesario | Retencion y protecciones |
| Logs | Minimizar y aplicar plazos documentados | Proveedores y plazos |
| Backups | Documentar rotacion, acceso y recuperacion sin reintroducir datos indebidamente | Ciclo real de proveedores |
| Datos del navegador | Limpiar sesion y estado local cuando corresponda | Pruebas por navegador |

NINGUN PLAZO DE RETENCION QUEDA APROBADO POR ESTE DOCUMENTO.

## 3. Tramite manual propuesto

1. Recibir solicitud en la app o en roomsapp@gmail.com.
2. Registrar fecha, identificador y estado del expediente.
3. Comprobar identidad de forma proporcionada si es necesario.
4. Determinar alcance y excepciones justificadas.
5. Revisar dependencias compartidas y documentos aplicables.
6. No ejecutar eliminacion si falla cualquier control de seguridad.
7. Ejecutar solo con procedimiento autorizado y probado.
8. Verificar Auth, base de datos y Storage independientemente.
9. Documentar resultado y comunicar respuesta al solicitante.
10. Conservar solo evidencia minima cuando proceda.

Responder en los plazos legales aplicables. Validar con asesoramiento
juridico las excepciones y la gestion de cada solicitud.

## 4. Bloqueos tecnicos actuales

- El coordinador solo permite cuentas QA desechables.
- El cierre administrativo real permanece deshabilitado.
- Falta acreditar barrera efectiva en Storage, incluida concurrencia.
- No existe procedimiento aprobado para todos los datos compartidos.
- El comportamiento historico "Usuario eliminado" no esta aprobado
  ni conectado a persistencia real.
- Ninguna prueba simulada autoriza suprimir usuarios reales.

## 5. Criterios de aceptacion antes de abrir la beta

[ ] Identidad del responsable y domicilio validados.
[ ] Proveedores, transferencias y contratos revisados.
[ ] Finalidades y bases juridicas validadas.
[ ] Plazos o criterios de conservacion aprobados por categoria.
[ ] Tratamiento de mensajes y contenido compartido aprobado.
[ ] Procedimiento manual de derechos asignado y documentado.
[ ] Baja integral probada en entorno aislado y seguro.
[ ] Barreras concurrentes de DB y Storage verificadas.
[ ] Prueba de confirmacion de email y registro por invitacion.
[ ] Politica de privacidad y condiciones aprobadas.
[ ] Versionado y aceptacion legal comprobados.
[ ] Seguridad y configuracion remota revisadas.
[ ] Autorizacion expresa de apertura.

## 6. Decision de lanzamiento

BETA PRIVADA: NO GO.

Mantener el registro cerrado en frontend y Supabase.
No aplicar SQL borrador, no eliminar cuentas reales,
no publicar textos sin revision y no desplegar sin autorizacion.
