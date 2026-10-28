# ROOMS - Expediente de revision beta privada

Estado: EN PREPARACION.
NO PUBLICAR. NO AUTORIZA APERTURA DE REGISTRO.
Fecha de preparacion: 2026-10-28.

## 1. Alcance de la beta

Beta privada por invitacion, dirigida a mayores
de 18 anos.

ROOMS facilita busqueda de vivienda, perfiles,
compatibilidad, comunidades y comunicacion.

No gestiona pagos, fianzas ni contratos.

Pendiente: validar juridicamente esta delimitacion
y su correspondencia con la aplicacion.

## 2. Responsable y contacto

Responsable previsto durante la beta:
Claudia Villanueva Santamaria, persona fisica.

Contacto previsto: roomsapp@gmail.com

PENDIENTE:
- Identificacion fiscal necesaria.
- Domicilio valido de contacto.
- Comprobar obligaciones de informacion aplicables.
- Revisar necesidad de DPD.
- Validacion juridica de la titularidad.

No presentar ROOMS como sociedad constituida.

## 3. Documentos de referencia

- docs/legal/politica-privacidad-v2-revision.md
- docs/legal/condiciones-uso-v2-revision.md
- docs/legal/matriz-conservacion-beta-revision.md
- docs/review/deletion-m58-contract.md

Los cuatro documentos requieren revision y no
constituyen autorizacion de publicacion.

## 4. Decisiones de conservacion

### Datos propios

Propuesta:
Suprimir perfil, DNA, preferencias, anuncios,
ubicaciones privadas, fotografias propias y
guardados cuando proceda la baja.

Pendiente:
Dependencias, excepciones legales, backups,
logs, Storage y comprobacion de supresion.

### Conversaciones compartidas

Propuesta de producto:
Si existe fundamento juridico valido, permitir
al participante que permanece consultar el
historial anterior, mostrando Usuario eliminado.

Condiciones previstas:
- No mostrar perfil ni fotografia del eliminado.
- No permitir nuevos mensajes.
- Acceso restringido al participante autorizado.
- Minimizar identificadores y datos personales.
- Definir finalidad y plazo de conservacion.

ESTADO: NO APROBADO. NO IMPLEMENTADO.

Las claves foraneas actuales ON DELETE CASCADE
pueden eliminar el historial al borrar Auth.

No conservar copias nuevas de mensajes reales
hasta resolver el diseno juridico y tecnico.

### Datos de seguridad y reportes

Pendiente:
- Fundamento juridico.
- Minimización.
- Acceso administrativo.
- Criterios de conservacion.
- Supresion o bloqueo cuando corresponda.

### Auditorias y solicitudes de baja

Propuesta:
Conservar la evidencia minima necesaria para
gestionar y acreditar la tramitacion.

Pendiente:
Plazos, campos, acceso, seguridad y supresion.

## 5. Procedimiento de baja

ESTADO ACTUAL:
- Solicitud administrativa implementada.
- Eliminacion integral no habilitada.
- Coordinador y verificadores probados localmente.
- Barrera integral de escritura no completada.
- Prueba real integral pendiente.

No afirmar que solicitar una baja equivale a
una eliminacion completada.

Para autorizar la operacion se necesita:
- Matriz de conservacion aprobada.
- Tratamiento de mensajes resuelto.
- Cobertura de escrituras concurrentes.
- Inventario de tablas y Storage actualizado.
- Control de permisos administrativos.
- Prueba con cuenta estrictamente desechable.
- Verificacion posterior y plan de recuperacion.

## 6. Proveedores y transferencias

Proveedores identificados para verificar:
- Supabase.
- Vercel.
- OpenStreetMap y proveedor real de teselas.
- jsDelivr.
- Otros recursos externos realmente cargados.

Pendiente:
- Entidad contractual.
- Ubicacion y accesos a datos.
- Encargados y subencargados.
- Condiciones de tratamiento.
- Transferencias internacionales y garantias.
- Politica de cookies y almacenamiento local.

No afirmar permanencia exclusiva en la UE sin
evidencia de la configuracion y contratos.

## 7. Evidencias tecnicas ya obtenidas

FUNCIONAL:
- M3 Journey: 6/6.
- Discovery Beta: 27/27.
- Registro UI: bloqueo validado.

SUPABASE REMOTO:
- Trigger rooms_beta_registration_closed
  habilitado.
- Trigger rooms_capture_signup_terms habilitado.
- RLS activo en siete tablas sensibles revisadas.
- Sin acceso SELECT anonimo directo a esas tablas.
- messages: UPDATE de authenticated limitado
  a la columna read_at.
- Funciones rooms_admin revisadas sin EXECUTE
  para anon ni authenticated.
- Funcion administrativa de cierre definitivo
  sin EXECUTE para service_role.

LIMITACIONES:
- No constituye auditoria total de seguridad.
- No certifica la configuracion de WAF,
  secretos, cuotas o limites del entorno.
- No acredita supresion real integral.
- No sustituye la revision juridica.

Ultimo commit de referencia:
c548c44

## 8. Aprobaciones necesarias

[ ] Identificacion legal del titular.
[ ] Inventario definitivo de datos y proveedores.
[ ] Conservacion por categoria validada.
[ ] Tratamiento de conversaciones compartidas.
[ ] Procedimiento operativo de bajas validado.
[ ] Politica de privacidad definitiva.
[ ] Condiciones de uso definitivas.
[ ] Versionado y aceptacion legal verificados.
[ ] Configuracion remota de produccion revisada.
[ ] Autorizacion explicita de apertura de beta.

## 9. Decision actual

BETA PRIVADA: NO GO.

Mantener el registro cerrado en frontend y
Supabase hasta completar los requisitos.

No ejecutar eliminaciones reales, no aplicar
borradores SQL y no publicar documentos en
revision sin autorizacion.
