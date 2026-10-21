# ROOMS - Seguridad de produccion para beta privada

Estado: pendiente de configurar antes del lanzamiento.

## Geolocalizacion

Endpoint: POST /api/geocode

Protecciones implementadas:
- Direccion entre 5 y 200 caracteres
- Cuerpo maximo de 4096 bytes
- Timeout externo de 8 segundos
- Metodos HTTP restringidos

## Vercel Firewall

Configurar una regla WAF limitada a:
- Ruta: /api/geocode
- Metodo: POST
- Identificador de origen: IP
- Ventana inicial: 60 segundos
- Umbral inicial propuesto: 10 solicitudes

Activar primero observacion y revisar falsos positivos.
Despues habilitar respuesta HTTP 429.
Revisar disponibilidad y costes en el proyecto.

No se considera esta proteccion activa hasta verificarla
en el despliegue real.

## Criterio GO / NO GO

NO GO si:
- No existe proteccion de frecuencia activa y comprobada
- GEOAPIFY_API_KEY no esta configurada de forma privada
- Se exponen credenciales administrativas al navegador
- No se han verificado las rutas privadas del despliegue

No realizar despliegues sin autorizacion expresa.
