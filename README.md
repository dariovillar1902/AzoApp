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
  - **Nafta**: escribí "nafta $40000" (sin monto toma $40.000) y te dice
    qué estación y qué día te conviene con tus medios, cuánto ahorrás, y
    abajo las promos que tendrías con otros medios.
  - **Otros comercios**: si el ítem se compra en pescadería, carnicería,
    verdulería, panadería, etc. ("filet de merluza"), muestra las promos de
    esos comercios con un precio estimado (el de las cadenas menos el
    descuento) y lo marca 💡 cuando sale más barato. Lo mismo con farmacias
    que no comparamos (Farmalife).
  - **Por producto** muestra además la mejor opción en el otro tipo de
    tienda: farmacia, súper u online (Mercado Libre).
  - "Menos paradas" (activado por defecto) solo agrega una tienda si ahorra
    más de $3.000.
  - Si eligió mal un producto: **✗ No es esto** lo descarta (junto con
    las otras presentaciones con el mismo nombre en esa cadena) y vuelve a
    planificar; **Elegir otro** muestra lo que vende esa cadena para que
    elijas a mano. Las correcciones se recuerdan ("Deshacer correcciones"
    las borra).
  - Checklist para tildar en el súper, **Ya compré acá** (descuenta lo
    usado del tope de esa promo), **Recordarme** (notificación a las 9:00
    del día elegido) y **Compartir** (texto para WhatsApp).
  - 📷 Escáner de código de barras: agrega el producto exacto (EAN) a la
    lista. 📍 "Cerca mío": la sucursal más cercana de cada cadena
    (OpenStreetMap) con link para llegar. Precio por kg / l / unidad para
    comparar tamaños.
  - Historial de precios en el dispositivo: debajo de cada producto, si
    subió/bajó desde la última vez, el mínimo visto y un aviso cuando el
    "precio antes" es más alto que todo lo que se le vio cobrar.
- **Semana**: tus promos día por día (súper, farmacia, nafta), con topes,
  mínimos, cómo pagar, vigencia y la fuente. En las que tienen tope
  mensual/semanal ves cuánto te queda y podés corregirlo ("Editar"). La
  campanita agenda un recordatorio semanal los días de esa promo.
- **Explorar**: los beneficios que publican Santander, Ciudad y BBVA (leídos
  en vivo por la API de la app) más el catálogo curado, filtrados por
  defecto a tus medios.
- **Mis medios**: qué bancos/tarjetas/billeteras tenés, segmentos
  (jubilados) y en qué cadenas comparar. Se guarda en el dispositivo.
  "Registrar reintegros": pegás los avisos de reintegro de Mercado Pago,
  MODO o el banco y se descuentan del tope de la promo que corresponde.
  "Respaldo": exporta todo (medios, topes, correcciones, lista, historial)
  como una línea de texto para pasarlo a otro dispositivo.

## Cómo decide

1. Busca cada ítem en Carrefour, Coto, Día, Jumbo, Disco, Vea, ChangoMás,
   Farmacity, Farmaplus, Farmaonline, Farmatodo y Mercado Libre (APIs públicas de cada
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
- Santander, Ciudad y BBVA se leen **en vivo** de sus APIs públicas
  (`lib/benefits/bankDiscounts.ts`); el planificador usa las que nombran una
  cadena, un % y los días. Si además corrés el backend .NET y seteás
  `DISCOUNTS_API_URL`, suma lo que scrapea (Club La Nación, Semana Nación).
- PedidosYa Market no tiene una API pública de productos,
  así que no se compara.
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
  app/api/branches+api.ts GET: sucursal más cercana de cada cadena (OpenStreetMap)
  app/api/discounts+api.ts GET: beneficios para Explorar (bancos en vivo + catálogo)
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

Proyecto `azoapp-frontend` (Root Directory `frontend`). `frontend/vercel.json`
+ `frontend/api/index.js` sirven el build de Expo (páginas + API routes) con
`expo-server/adapter/vercel`. Producción sale de `main`; cada push a otra
rama genera un preview.

**Importante:** en Settings → Deployment Protection, poné Vercel
Authentication en **Standard Protection**. Con "All Deployments" la URL de
producción pide login de Vercel y la app del iPhone no puede llamar a la API.
Recomendado: Settings → Functions → región `gru1` (São Paulo). Desde EE.UU.
(`iad1`, el default) Santander y Banco Ciudad no responden en Explorar.

**Mercado Libre** bloquea los servidores de Vercel (pide verificación). Para
compararlo desde Vercel: creá una app gratis en
developers.mercadolibre.com.ar y cargá `MELI_CLIENT_ID` y
`MELI_CLIENT_SECRET` en Settings → Environment Variables. Sin eso funciona
solo con `npx expo start` desde tu PC (usa tu conexión) y en Vercel aparece
como "sin respuesta".

## Usarlo en el iPhone (Expo Go)

La app usa Expo SDK 57 (Expo Go 57.x). Si Expo Go dice "Project is incompatible", la versión de Expo Go y la del SDK no coinciden.

1. Instalá **Expo Go** desde el App Store.
2. En la PC (misma Wi-Fi que el iPhone):
   ```powershell
   cd AzoApp\frontend
   git pull
   npm install
   npx expo start
   ```
   Si el firewall de Windows pregunta por Node.js, permitilo en redes privadas.
3. En el iPhone, abrí la **Cámara**, apuntá al QR de la terminal y tocá el
   aviso. Permití "Red local" cuando lo pida.
4. Si no conecta: `npx expo start --tunnel`.

Con la app abierta desde la PC, las búsquedas de precios salen de tu
conexión. Sin la PC (o en un build instalado) la app usa
`https://azoapp-frontend.vercel.app`. También podés abrir esa URL en Safari y
"Agregar a pantalla de inicio" (todo menos notificaciones).

Para instalarla como app propia (sin Expo Go) hace falta una cuenta de Apple
Developer y `eas build -p ios` + TestFlight.

El backend .NET (`cd backend && dotnet run --project DiscountApp.Api`) es
opcional: la app ya no lo necesita.
