# Panel de administración 🌯

Interfaz web para revisar la actividad de burritos y gestionar los cumpleaños del
equipo. Se sirve desde el propio backend, sin build step: son archivos estáticos
en `ui/`.

- **Acceso:** `GET /admin/login`
- **Panel:** `GET /admin/ui`
- La raíz (`/`) redirige a una u otra según haya sesión.

Credenciales: `ADMIN_USERNAME` y `ADMIN_PASSWORD`. El login devuelve un JWT
(`JWT_SECRET`, 1 h de vigencia) que el panel guarda en `localStorage` y envía en
cada petición. Al expirar, el panel redirige al login automáticamente.

## Secciones

| Sección | Qué muestra |
| --- | --- |
| **Resumen** | KPIs (totales, hoy, mes, promedio diario, usuarios activos, cumpleaños), gráfico de actividad de 30 días, top 5 receptores y próximos cumpleaños. Avisa si alguien cumple hoy. |
| **Ranking** | Todos los usuarios ordenados por burritos recibidos o dados, con buscador y barras de proporción. |
| **Movimientos** | Historial completo de burritos entregados, paginado de 25 en 25, con fecha absoluta y relativa. |
| **Cumpleaños** | Alta/edición y borrado de cumpleaños, más el botón «Anunciar ahora» que publica el saludo del día. |

## Detalles de implementación

- **Sin dependencias de frontend.** `ui/dashboard.html` lleva los estilos y
  `ui/src/dashboard.js` la lógica, como módulo ES nativo.
- **Tema claro/oscuro.** Sigue al sistema por defecto; el botón `◐` alterna entre
  automático, claro y oscuro y guarda la preferencia en `localStorage`.
- **Responsive.** Por debajo de 860 px el menú lateral pasa a pestañas
  horizontales y las tablas hacen scroll dentro de su contenedor.
- **A prueba de inyección.** Todo dato del API se pinta con `textContent`, nunca
  con `innerHTML`, así que un mensaje de burrito con HTML no puede inyectar
  marcado.
- **Navegación por hash.** `#ranking`, `#transactions`, `#birthdays` son
  enlazables y recargables.
- **Autorrefresco** cada 60 s, solo cuando la pestaña está visible.

## Ventanas de tiempo

Los contadores y el gráfico usan **UTC** para que coincidan entre sí: «hoy» es
desde las 00:00 UTC, «este mes» desde el día 1 del mes en curso (año incluido) y
el promedio diario es el total de los últimos 30 días dividido entre 30.

## Idioma

El panel está en español. Los mensajes de error que vienen del backend (por
ejemplo, si Slack rechaza la publicación del saludo) siguen a `DEFAULT_LANGUAGE`,
que también controla el idioma del bot en Slack. Ponlo en `es` si quieres todo en
español.

## Requisito de versión de Node

`jsonwebtoken` (vía `@nestjs/jwt`) usa `Buffer.SlowBuffer`, eliminado en Node 24.
La app arranca en **Node 18–22**; el `Dockerfile` usa Node 18. En Node 24+ falla
al cargar `AdminModule`/`AuthModule`.
