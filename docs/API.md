# API REST · Farma

Base local: `http://127.0.0.1:3001/api`. Cuerpos JSON. Autenticación mediante cookie `farma_session` (HttpOnly, SameSite=Strict, duración 8 horas). En clientes web externos usar `credentials: 'include'` y declarar su origen en `CLIENT_ORIGIN`.

## Respuestas

Registro: `{ "data": { ... } }`. Listado: `{ "data": [], "pagination": { "page": 1, "limit": 20, "total": 0, "pages": 0 } }`. Borrado: HTTP 204 sin cuerpo. Error: `{ "message": "Descripción", "errors": [{ "field": "name", "message": "Detalle" }] }`; `errors` se incluye solo para validaciones.

Listados: `q` busca texto, `page` comienza en 1 y `limit` admite 1–1000. Las consultas usan parámetros SQL y escapan comodines de búsqueda. La aplicación pagina visualmente en grupos de 8 y recupera todas las páginas de la API para filtrar y exportar el conjunto completo.

| Método | Ruta                  | Uso                                                                                           |
| ------ | --------------------- | --------------------------------------------------------------------------------------------- |
| GET    | `/health`             | Estado de conexión con SQL Server, público.                                                   |
| POST   | `/auth/login`         | `{ "email": "admin@farma.local", "password": "..." }`. Límite: 20 intentos/15 minutos por IP. |
| GET    | `/auth/me`            | Usuario autenticado.                                                                          |
| POST   | `/auth/logout`        | Elimina la cookie de sesión.                                                                  |
| GET    | `/dashboard`          | Indicadores, distribución de vencimientos, lotes urgentes, stock bajo y categorías.           |
| GET    | `/products`           | Lista, búsqueda `q`, filtro `category`.                                                       |
| GET    | `/products/:id`       | Detalle de producto con stock calculado.                                                      |
| POST   | `/products`           | Crea producto.                                                                                |
| PUT    | `/products/:id`       | Actualiza todos los campos del producto.                                                      |
| DELETE | `/products/:id`       | Elimina si no tiene lotes.                                                                    |
| GET    | `/shelves`            | Lista y búsqueda por código, nombre o ubicación.                                              |
| GET    | `/shelves/:id`        | Detalle de estante.                                                                           |
| POST   | `/shelves`            | Crea estante.                                                                                 |
| PUT    | `/shelves/:id`        | Actualiza estante.                                                                            |
| DELETE | `/shelves/:id`        | Elimina si no tiene lotes.                                                                    |
| GET    | `/batches`            | Lista, búsqueda, filtros `status`, `productId`, `shelfId`; orden FEFO.                        |
| GET    | `/batches/:id`        | Lote con días restantes y clasificación.                                                      |
| POST   | `/batches`            | Registra lote e ingreso en una transacción.                                                   |
| PUT    | `/batches/:id`        | Edita metadatos. Producto y cantidad deben conservarse.                                       |
| POST   | `/batches/:id/adjust` | Ajusta cantidad, registra motivo y responsable.                                               |
| DELETE | `/batches/:id`        | Elimina exclusivamente un lote con cantidad cero.                                             |
| GET    | `/alerts`             | Lotes con cantidad > 0 y vencimiento ≤ 90 días; acepta los filtros de lotes.                  |
| GET    | `/movements`          | Historial, búsqueda, orden descendente por fecha.                                             |

## Cuerpos de ejemplo

Producto:

```json
{
  "name": "Paracetamol 500 mg",
  "description": "Caja de 20 comprimidos",
  "category": "Analgésicos",
  "purchasePrice": 8.5,
  "salePrice": 15.0,
  "minStock": 50
}
```

Estante:

```json
{
  "code": "EST-A01",
  "name": "Medicamentos generales",
  "location": "Pasillo A · Nivel 1",
  "description": "Medicamentos de uso frecuente"
}
```

Lote (fechas en formato `YYYY-MM-DD`; usar IDs existentes y fechas apropiadas):

```json
{
  "productId": 1,
  "shelfId": 1,
  "batchNumber": "PAR-2603",
  "entryDate": "2026-11-05",
  "expiryDate": "2027-11-05",
  "quantity": 80
}
```

Ajuste (delta positivo: entrada; negativo: salida):

```json
{ "delta": -5, "reason": "Retiro por deterioro del empaque" }
```

`status`: `expired`, `30`, `60`, `90`, `healthy`. Los rangos no se superponen. El stock de producto se calcula sumando cantidades de lotes vigentes.

Códigos: 200 correcto; 201 creado; 204 eliminado; 400 datos inválidos; 401 sesión ausente/vencida; 403 origen no permitido; 404 recurso inexistente; 409 duplicado, relación activa o ajuste imposible; 413 cuerpo excesivo; 429 demasiados intentos; 503 error de base o servicio.

## Ejemplo con curl

```sh
curl -c cookies.txt -H "Content-Type: application/json" -d '{"email":"admin@farma.local","password":"Farma2026!"}' http://127.0.0.1:3001/api/auth/login
curl -b cookies.txt "http://127.0.0.1:3001/api/products?q=Paracetamol"
curl -b cookies.txt "http://127.0.0.1:3001/api/alerts?status=30"
```

En PowerShell usa `curl.exe` y adapta las comillas para tu versión del shell. Borra el archivo de cookies al terminar y no lo subas al repositorio.
