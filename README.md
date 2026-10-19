# AzoApp

Escribís lo que necesitás comprar y te dice **dónde y cuándo** comprar cada
cosa, usando solo los descuentos de los bancos, tarjetas y billeteras que
tenés (Buenos Aires). Si es una lista, la divide por tienda y elige el mejor
día para cada visita.

Unifica en una sola app lo que antes estaba en `comparador-precios-ar`
(que a su vez juntaba `comparador-super-ar` y `comparador-farmacias-ar`) y
el scraper de beneficios bancarios que ya tenía este repo.

## Pantallas

- **Mi lista**: pegás la lista ("2 leche entera 1l", "yerba 1kg",
  "ibuprofeno", "nafta"…). Devuelve:
  - **Por tienda**: qué comprar en cada cadena, qué día, con qué promo y el
    total. "Si no podés ese día" muestra el mismo carrito en los otros días.
  - **Por producto**: el mejor lugar+día para cada ítem, y el mejor de hoy.
  - **Todo en un solo lugar**: la mejor cadena para comprar todo junto.
  - Lo que no venden las cadenas (ej. nafta) muestra las promos de esa
    categoría que te corresponden.
  - "Menos paradas" (activado por defecto) solo agrega una tienda si ahorra
    más de $3.000.
  - Si eligió mal un producto: **✗ No es esto** lo descarta y vuelve a
    planificar; **Elegir otro** muestra lo que vende esa cadena para que
    elijas a mano. Las correcciones se recuerdan ("Deshacer correcciones"
    las borra).
  - Checklist para tildar en el súper, **Ya compré acá** (descuenta lo
    usado del tope de esa promo), **Recordarme** (notificación a las 9:00
    del día elegido) y **Compartir** (texto para WhatsApp).
  - Historial de precios en el dispositivo: debajo de cada producto, si
    subió/bajó desde la última vez, el mínimo visto y un aviso cuando el
    "precio antes" es más alto que todo lo que se le vio cobrar.
- **Semana**: tus promos día por día (súper, farmacia, nafta), con topes,
  mínimos, cómo pagar, vigencia y la fuente. En las que tienen tope
  mensual/semanal ves cuánto te queda y podés corregirlo ("Editar"). La
  campanita agenda un recordatorio semanal los días de esa promo.
- **Explorar**: los beneficios que scrapea el backend .NET (Santander,
  Ciudad, Nación, Club La Nación, BBVA, Swiss Medical), filtrados por
  defecto a tus medios.
- **Mis medios**: qué bancos/tarjetas/billeteras tenés, segmentos
  (jubilados) y en qué cadenas comparar. Se guarda en el dispositivo.
  "Registrar reintegros": pegás los avisos de reintegro de Mercado Pago,
  MODO o el banco y se descuentan del tope de la promo que corresponde.

## Cómo decide

1. Busca cada ítem en Carrefour, Coto, Día, Jumbo, Disco, Vea, ChangoMás,
   Farmacity, Farmaplus, Farmaonline y Farmatodo (APIs públicas de cada
   sitio) y elige el producto más parecido (texto + tamaño; código de
   `comparador-precios-ar`).
2. Para cada tienda y cada uno de los próximos 7 días, aplica la mejor promo
   que tengas (las promos no se suman; respeta tope, compra mínima y
   vigencia).
3. Arranca con cada ítem en su tienda más barata y mejora moviendo ítems o
   visitas enteras entre tiendas. Así, por ejemplo, junta leche y yerba en
   Día para superar el mínimo de $35.000 de BNA+ MODO aunque cada ítem por
   separado sea más barato en otro lado.

Un tope mensual/semanal es un solo presupuesto para todo el plan (dos
farmacias con la misma promo MODO no reciben el tope completo cada una), y
se le resta lo que ya registraste como usado.

## Promociones

- `frontend/lib/benefits/catalog.ts`: catálogo curado para tus medios
  (revisado el 19/10/2026). Cada promo indica qué medios requiere
  (todos), días, tope, mínimo, vigencia y fuente. Las marcadas
  **Verificar** salen de notas de prensa o del relevamiento de septiembre:
  confirmalas en la app del banco antes de pagar.
- Coto se lee **en vivo** de su API pública.
- Si el backend .NET está corriendo y seteás `DISCOUNTS_API_URL` (ej.
  `http://localhost:5075`), el planificador también usa lo que scrapea de
  Santander, Ciudad, Nación y Club La Nación, cuando nombra una cadena, un %
  y los días.
- Una tarea programada de Claude ("Actualizar promos AzoApp", días 1 y 15)
  revisa el catálogo y abre un PR con los cambios.
- Para refrescar: pedile a Claude "actualizá el catálogo de promos de
  AzoApp".

## Estructura

```
frontend/                 Expo (iOS/Android/web) + API routes
  app/(tabs)/             pantallas
  app/api/plan+api.ts     POST: lista -> plan
  app/api/promos+api.ts   GET: catálogo + promos en vivo de Coto
  app/api/alternatives+api.ts  GET: productos de una cadena para elegir a mano
  lib/core/               normalización y matching de productos
  lib/stores/             buscadores por cadena (VTEX, Coto, Farmatodo)
  lib/benefits/           medios, catálogo, elegibilidad
  lib/planner/            planificador (puro) + servicio que busca precios
backend/                  .NET 9: scrapers de beneficios -> /api/discounts
```

## Correrlo

```bash
cd frontend
npm install
npm start            # Expo dev server (web en http://localhost:8081, API routes incluidas)
npm test             # tests del planificador, matching y promos
npm run typecheck
```

En el celular (Expo Go) las API routes se sirven desde el mismo dev server.
Los recordatorios usan notificaciones locales: funcionan en el celular, no
en la web.

## Deploy (Vercel)

`frontend/vercel.json` + `frontend/api/index.js` sirven el build de Expo
(páginas + API routes) con el adaptador `expo-server/adapter/vercel`.

1. En vercel.com → Add New → Project → importá `dariovillar1902/AzoApp`.
2. **Root Directory = `frontend`**. Framework: "Other" (vercel.json define
   build, output y rewrites). Opcional: Settings → Functions → región
   `gru1` (São Paulo), la más cercana a Buenos Aires.
3. Para la app del celular, seteá `EXPO_PUBLIC_API_ORIGIN` con la URL del
   deploy al compilarla.

El backend .NET (`cd backend && dotnet run --project DiscountApp.Api`) solo
hace falta para la pestaña **Explorar**.
