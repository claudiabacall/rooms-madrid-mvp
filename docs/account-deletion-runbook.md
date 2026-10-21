# ROOMS - Procedimiento de baja de cuentas

Estado: procedimiento administrativo para beta privada.
La eliminacion automatica NO esta implementada.

## 1. Recepcion

Las solicitudes se registran en:
public.account_deletion_requests

Solo una persona autorizada debe gestionar las solicitudes.
Verificar la identidad antes de iniciar cualquier eliminacion.

Estados disponibles:
- pending
- processing
- completed
- rejected

La decision sobre plazos y conservacion requiere revision legal.

## 2. Inventario

Identificar exclusivamente los datos del usuario solicitante.

Revisar:
- Perfil y ROOMS DNA
- Preferencias e intenciones
- Viviendas y direcciones privadas
- Conexiones y mensajes
- Comunidades, Hogares y publicaciones
- Reportes de moderacion
- Objetos de Storage

No eliminar informacion de terceros indiscriminadamente.

## 3. Storage

Buckets:
- avatars
- listing-images
- community-images
- community-post-media

En todos ellos la ruta comienza por:
USER_ID/

La limpieza debe:
- Enumerar recursivamente todas las carpetas
- Gestionar paginacion
- Eliminar mediante la API de Supabase Storage
- Comprobar errores por lote
- Volver a enumerar hasta verificar cero archivos

Nunca limitarse a eliminar filas de storage.objects
mediante SQL directo.

No borrar un bucket completo.

## 4. Auth y base de datos

Solo despues de completar los pasos previos:
- Resolver obligaciones de conservacion
- Comprobar dependencias y referencias compartidas
- Ejecutar baja autorizada desde backend administrativo
- Verificar relaciones ON DELETE CASCADE y SET NULL
- Confirmar ausencia de datos que debian suprimirse

No proporcionar la service_role key al navegador.

## 5. Evidencia y cierre

Registrar:
- Identificador administrativo de la solicitud
- Fecha de recepcion
- Fecha de ejecucion
- Operador autorizado
- Resultado de verificacion
- Incidencias, excepciones y justificacion

La tabla account_deletion_requests referencia auth.users
con ON DELETE CASCADE: su fila desaparecera cuando
se elimine Auth.

Por tanto, antes de ejecutar bajas reales se necesita
un registro administrativo de cierre independiente,
con minimizacion de datos y retencion definida.

## 6. Criterio de lanzamiento

NO GO para tramitar bajas reales hasta que:
- Exista responsable operativo designado
- Exista registro administrativo seguro
- El proceso completo se pruebe con una cuenta QA
  creada especificamente para ello
- Se verifique la eliminacion de Storage y BD
- El texto legal refleje el procedimiento real
