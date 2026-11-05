# Verificación de la entrega

Fecha: 5 de noviembre de 2026. Entorno: Windows, Node.js 24 y SQL Server local con autenticación integrada.

## Validaciones ejecutadas

- `npm test`: 5 pruebas unitarias aprobadas.
- `npm run test:integration`: 7 pruebas aprobadas, incluyendo el escenario principal y sus 6 subpruebas, sobre SQL Server real.
- `npm run build`: compilación de React/Vite correcta, con tipografías locales y sin dependencia de servicios de fuentes externos.
- Prueba web: inicio de sesión, búsqueda de productos, registro de producto, registro de lote con fechas, clasificación automática de la alerta y ajuste de 25 a 20 unidades.
- Prueba de escritorio: panel de 1440 px sin desbordamiento horizontal.
- Prueba móvil: navegación lateral, filtros de vencidos y tablas con desplazamiento interno en 390 px, sin desbordamiento de la página.
- Prueba de aplicación compilada: Express sirve el frontend y la API en el puerto 3001 y recupera el inventario real.

Las pruebas de integración verificaron también restricciones de claves foráneas, duplicados, eliminación de lotes sin stock, conservación de movimientos y dos salidas simultáneas que no pueden consumir las mismas unidades. Los rangos se comprobaron en los límites −1, 0, 30, 31, 60, 61, 90 y 91 días.

Los registros temporales de la API y de la prueba visual se retiraron al finalizar. Se conservan los datos de demostración: 12 productos, 4 estantes y 15 lotes.

Las capturas en `docs/screenshots` muestran el sistema funcionando. GitHub Actions tiene su propia validación de pruebas unitarias y compilación; este informe corresponde a la ejecución local y no afirma un resultado de CI remoto.
