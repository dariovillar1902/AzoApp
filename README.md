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
    usado del tope de esa promo) y **Compartir** (texto para WhatsApp).
- **Semana**: tus promos día por día (súper, farmacia, nafta), con topes,
  mínimos, cómo pagar, vigencia y la fuente. En las que tienen tope
  mensual/semanal ves cuánto te queda y podés corregirlo ("Editar").
- **Explorar**: los beneficios que scrapea el backend .NET (Santander,
  Ciudad, Nación, Club La Nación, BBVA, Swiss Medical), filtrados por
  defecto a tus medios.
- **Mis medios**: qué bancos/tarjetas/billeteras tenés, segmentos
  (jubilados) y en qué cadenas comparar. Se guarda en el dispositivo.

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
Para producción: `npx expo export --platform web` genera `dist/` con
`client/` y `server/` (deployable en EAS Hosting o cualquier Node), y en la
app nativa seteás `EXPO_PUBLIC_API_ORIGIN` con esa URL.

El backend .NET (`cd backend && dotnet run --project DiscountApp.Api`) solo
hace falta para la pestaña **Explorar**.
