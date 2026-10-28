# ROOMS M5.8 - Contrato de baja segura

ESTADO: PROPUESTA TECNICA. NO APROBADA.
NO EJECUTAR BAJAS REALES.
NO APLICAR SQL A SUPABASE SIN VALIDACION.

## Objetivo

Permitir tramitar una solicitud de baja sin:
- eliminar indebidamente datos de terceros;
- conservar datos personales sin justificacion;
- dejar archivos propios accesibles en Storage;
- permitir escrituras concurrentes no controladas;
- declarar completada una baja sin verificacion.

## Fase A - Solicitud

1. Usuario autenticado solicita la baja.
2. Registrar solicitud vinculada a su identidad.
3. Evitar solicitudes administrativas duplicadas.
4. Verificar titularidad y estado de la solicitud.
5. No iniciar supresion hasta disponer de un
   procedimiento autorizado y probado.

## Fase B - Plan de tratamiento

Clasificar:
- Perfil, DNA, preferencias y datos propios.
- Anuncios, ubicaciones y fotografias.
- Conexiones, guardados y pertenencias.
- Comunidades y hogares compartidos.
- Conversaciones y mensajes.
- Bloqueos, reportes y evidencias de seguridad.
- Auditorias, logs y copias de seguridad.

La conservacion de mensajes para otros participantes
requiere justificacion juridica y diseno separado.

No crear historiales retenidos con datos reales
hasta resolver esa decision.

## Fase C - Control de ejecucion

Requisitos previos:
- Exclusividad de la ejecucion administrativa.
- Barrera efectiva para escrituras concurrentes.
- Cobertura de RPC, escrituras privilegiadas y Storage.
- Inventario actualizado de dependencias y cascadas.
- Tratamiento de contenido compartido documentado.
- Plan de recuperacion ante fallos parciales.
- Pruebas con cuentas estrictamente desechables.

Las barreras SQL actuales son propuestas parciales.
No se consideran proteccion suficiente.

## Fase D - Verificacion

Verificar separadamente:
1. Ausencia de cuenta en Auth.
2. Ausencia de referencias no autorizadas en DB.
3. Estado de archivos y objetos en Storage.
4. Impacto sobre otros usuarios.
5. Evidencia minima de tramitacion.
6. Consistencia ante fallos y reintentos.

La RPC rooms_admin_verify_deleted_user no cubre
por si sola todos estos puntos.

## Criterios para autorizar ejecucion real

- Validacion juridica de la matriz de conservacion.
- Diseno de mensajes compartidos resuelto.
- Barrera concurrente integral comprobada.
- Procedimiento administrativo seguro implementado.
- Pruebas automatizadas de error y recuperacion.
- Prueba integral controlada y verificacion posterior.
- Aprobacion explicita para habilitar la operacion.

## Estado para la beta

NO GO para eliminacion definitiva automatica.

Se mantiene disponible la solicitud de baja;
no debe afirmarse que equivale a supresion completada.
