# ROOMS - Criterios para abrir la beta privada

Estado inicial: NO GO.
Esta lista no autoriza un lanzamiento por si sola.

## A. Producto y experiencia

- [x] M1: base tecnica estable
- [x] M2: funcionalidades esenciales
- [x] M3: recorrido integral probado
- [ ] Repetir regresion final de usuario nuevo antes de abrir

## B. Registro y privacidad

- [x] Registro temporalmente bloqueado en interfaz local
- [ ] Identidad real del responsable y contacto definidos
- [ ] Politica de privacidad validada y publicada
- [ ] Condiciones de uso validadas y publicadas
- [ ] Aceptacion de condiciones registrada con version y fecha
- [ ] Verificar bloqueo/apertura de registro en Supabase Auth
- [ ] Comprobar recuperacion de contrasena y confirmacion de email

## C. Seguridad y bajas

- [x] Solicitudes de baja y RLS probadas
- [x] Motor de limpieza de Storage probado con simulaciones
- [x] Coordinador de baja probado con simulaciones
- [ ] Probar baja integral real con cuenta exclusivamente desechable
- [ ] Comprobar efectos sobre terceros y relaciones compartidas
- [ ] Verificar borrado final de Auth, BD y Storage
- [ ] Registrar evidencia administrativa de la baja
- [ ] Validar configuracion real de WAF y limites API
- [ ] Revisar secretos, permisos y URLs de produccion

## D. Preparacion M5

- [ ] Cerrar todos los bloqueantes anteriores
- [ ] Crear respaldo recuperable de los datos de prueba
- [ ] Limpiar solo los datos autorizados
- [ ] Mantener tablas, migraciones, RLS y codigo
- [ ] Crear acceso controlado para los participantes
- [ ] Ejecutar prueba completa de registro y onboarding
- [ ] Recoger incidencias y observaciones de usuarios

## Reglas

No eliminar cuentas QA ni datos actuales durante M4.
No ejecutar push ni desplegar sin peticion expresa.
Los documentos marcados como borrador no deben publicarse.
El bloqueo en la interfaz no sustituye el control en Supabase Auth.
Una prueba simulada no sustituye una verificacion contra servicios reales.
