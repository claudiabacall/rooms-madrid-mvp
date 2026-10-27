# ROOMS · Barrera de escrituras para eliminación de cuentas

Estado: DISEÑO PENDIENTE DE IMPLEMENTACIÓN Y VALIDACIÓN.
No autoriza eliminaciones reales ni despliegues.

## Decisión

La eliminación de cuentas se coordinará exclusivamente desde
un backend administrativo autorizado. No se activará por
cambios en el frontend ni por la mera existencia de una
auditoría en estado `processing`.

## Condiciones obligatorias

1. Solicitud válida e identidad del titular verificadas.
2. Política de conservación y tratamiento de datos
   compartidos aprobada antes de cualquier operación.
3. Cuenta desechable y operador administrativo autorizados
   para la primera prueba destructiva.
4. Reclamación exclusiva con auditId, targetId y claimToken.
5. Barrera de escrituras acreditada por el servidor:
   - Todas las rutas de escritura aplicables en base de datos.
   - Funciones SECURITY DEFINER y operaciones privilegiadas.
   - API oficial de Storage y todos los buckets afectados.
   - Escrituras previamente iniciadas ya finalizadas.
   - Protección mantenida durante toda la eliminación.
6. Verificación de impacto compartido antes de destruir datos.
7. Limpieza de Storage y nueva comprobación de su ausencia.
8. Eliminación de Auth.
9. Verificaciones independientes posteriores de Auth,
   base de datos y Storage.
10. Cierre de auditoría únicamente tras cuatro evidencias
    verificadas, mediante una operación protegida del servidor.

## Lo que NO constituye evidencia suficiente

- Un booleano enviado por el frontend.
- Una auditoría en estado `processing`.
- Un advisory lock utilizado solamente en la operación claim.
- Políticas RLS que puedan ser omitidas por rutas privilegiadas.
- Una consulta puntual de Storage sin impedir nuevas subidas.
- Tests simulados sin comprobación de permisos y concurrencia real.

## Estrategia de implementación

Fase A: inventariar todas las rutas de escritura y sus roles,
incluyendo RPC, triggers, funciones privilegiadas y Storage.

Fase B: implementar mecanismos de bloqueo que compartan
coordinación con el claim, sin impedir la limpieza autorizada.

Fase C: probar concurrencia real: escritura anterior al claim,
escritura posterior, operaciones en curso y service_role.

Fase D: integrar un verificador del backend que solo emita
evidencia de barrera después de superar las comprobaciones.

Fase E: ejecutar una baja de cuenta desechable, expresamente
autorizada, con comprobación posterior independiente.

## Decisiones y bloqueos vigentes

- La propuesta de 84 políticas está descartada para
  aplicación directa.
- No instalar triggers directamente en storage.objects.
- No asumir que RLS protege operaciones service_role.
- No habilitar `rooms_admin_complete_deleted_account`
  mientras falten garantías de Storage y concurrencia.
- No habilitar `deleteAuthUser` en ejecución real.
- Mantener pendientes la conservación legal, el destino
  de conversaciones compartidas y el plan de recuperación.

## Criterio de aceptación

No se considerará la barrera implantada hasta demostrar,
con pruebas reales y reproducibles, que ninguna ruta de
escritura relevante puede añadir datos de la cuenta durante
la eliminación y que la limpieza administrativa sigue siendo
posible de forma controlada.

Estado actual: NO GO.
