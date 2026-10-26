# ROOMS M6.8 — Mensajería tras eliminación de cuenta

Estado: PROPUESTA. No aprobada ni implementada.
No autoriza conservación ni eliminación de datos reales.

## Situación actual

- `messages.sender_id` y `messages.recipient_id` referencian
  `auth.users` con `ON DELETE CASCADE`.
- Las preferencias entre participantes también usan CASCADE.
- La bandeja depende de conexiones aceptadas.
- Las políticas RLS dependen de ambos identificadores y de
  `users_are_blocked`.
- Borrar una cuenta elimina mensajes compartidos y conexiones.

## Decisión propuesta

No modificar directamente las claves foráneas de mensajes
activos ni introducir identificadores nulos sin adaptar toda
la aplicación.

Estudiar un historial restringido e independiente para el
participante superviviente, condicionado a aprobación legal.

## Modelo conceptual

Registro de historial conservado:

- Identificador independiente del mensaje original.
- Identificador del usuario superviviente.
- Identificador opaco del historial, sin FK a la cuenta borrada.
- Dirección del mensaje vista desde el superviviente.
- Contenido mínimo cuya conservación haya sido autorizada.
- Fecha del mensaje.
- Fecha límite de conservación y base aplicable.
- Sin nombre, imagen, alias o perfil de la cuenta eliminada.

No almacenar identificadores reversibles de la cuenta borrada
sin justificación y protección específicas.

## Seguridad

- Lectura exclusiva por el superviviente autorizado.
- Sin escritura del cliente en el archivo histórico.
- Creación y eliminación solo desde backend administrativo.
- Sin capacidad de iniciar conversación ni enviar respuestas.
- Bloqueos, denuncias y obligaciones de supresión requieren
  reglas expresas antes de activar la función.
- Ante errores o evidencia incompleta: no conservar.

## Interfaz

- Mostrar "Usuario eliminado".
- Sin acceso al perfil antiguo.
- Historial de solo lectura, si está autorizado.
- No incluirlo entre conexiones activas.
- No generar notificaciones de nuevos mensajes.

## Condiciones previas a implementación

1. Decidir si existe base jurídica para conservar contenido
   y para qué finalidad concreta.
2. Aprobar plazos, supresión y tratamiento de denuncias.
3. Establecer si debe conservarse todo, parte o nada.
4. Revisar los derechos y expectativas de ambos participantes.
5. Diseñar migración, RLS y protocolo transaccional seguro.
6. Probar aislamiento entre usuarios, bloqueo de escritura,
   caducidad, errores parciales y baja de ambos participantes.
7. Verificar con cuenta desechable antes de habilitar bajas.

## Alternativa conservadora

Hasta completar esas condiciones, no activar archivo histórico.
Mantener bloqueada la eliminación administrativa real.

## Estado

DECISIÓN TÉCNICA PROPUESTA — NO GO PARA PRODUCCIÓN.
