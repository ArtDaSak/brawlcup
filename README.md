# Copa Brawl Sports Dúos - Proyecto Estático

Este es un proyecto web estático desarrollado con HTML, CSS vainilla y JavaScript (ES Modules). Permite registrar equipos, programar fechas y horas para las rondas, realizar el sorteo automático de descansos (en caso de equipos impares), generar emparejamientos y llevar el registro de estadísticas de juego y victoria para calcular la tabla general de posiciones de la liga.

La aplicación está dividida en dos páginas principales para separar las responsabilidades de visualización y edición:
- **Vista Pública (Home - `index.html`):** Una vista de solo lectura optimizada para que los jugadores y el público general consulten la tabla de posiciones, el calendario y los enfrentamientos.
- **Panel de Administración (`admin/index.html`):** Una interfaz protegida (operada localmente y accesible a través de `/admin`) que permite la carga y configuración de datos, el registro de dúos, el sorteo de descansos, la actualización de marcadores y la sincronización con la nube (MockAPI).

## Estructura del Proyecto

```txt
copa-brawl/
├─ index.html       <-- Vista pública (Solo lectura)
├─ admin/
│  └─ index.html    <-- Panel de administración (Escritura y Edición)
├─ styles.css
├─ js/
│  ├─ config.js
│  ├─ api.js
│  ├─ tournament.js
│  ├─ main.js       <-- Controlador de index.html (Solo lectura)
│  └─ admin.js      <-- Controlador de admin/index.html (Administración)
└─ README.md
```

## Características

- **Diseño Responsivo e Impactante:** Estilo moderno y de alta fidelidad con degradados dinámicos inspirados en Brawl Stars, optimizado para móviles y computadoras de escritorio.
- **Visualización Limpia (Home):** Muestra el estado del torneo actual sin inputs, botones de borrar o selects interactivos, con resaltados verdes para los ganadores de cada partido.
- **Gestión Completa (Admin):**
  - **Equipos:** Registro rápido de dúos (nombre del dúo, integrante 1, integrante 2 y notas) y opción de eliminar dúos.
  - **Sorteo de Descanso:** En caso de tener equipos impares, se puede sortear al azar el equipo que descansa en la Ronda 1, guardando un código único del sorteo para asegurar transparencia.
  - **Emparejamiento Inteligente:**
    - **Ronda 1:** Emparejamientos completamente aleatorios.
    - **Rondas 2 y 3:** Sistema de emparejamiento basado en puntos acumulados similares (sistema suizo), previniendo en la medida de lo posible emparejar equipos que ya hayan jugado previamente.
  - **Cálculo General de Puntos:**
    - **Victoria:** +5 puntos.
    - **Derrota:** +0 puntos.
    - **Descanso oficial (Bye):** +3 puntos.
    - **Victoria perfecta (sin recibir gol/canasta/punto):** +1 punto adicional al ganador.
    - **Acciones especiales (Trick shot/rebotes, infiltración, pase + anotación):** Otorga puntos adicionales (hasta un máximo de +4 puntos extra por dúo en cada ronda).
  - **Sincronización con MockAPI:** Soporte para guardar el estado del torneo en la nube en tiempo real.

## Instrucciones de Configuración y Despliegue

### 1. MockAPI (Opcional)
Para sincronizar el estado del torneo remotamente:
1. Crea un recurso en [MockAPI](https://mockapi.io) llamado `tournaments`.
2. Define los siguientes campos en el recurso:
   - `id` (creado automáticamente)
   - `name` (String)
   - `status` (String)
   - `payload` (String / Long text)
   - `createdAt` (Date)
   - `updatedAt` (Date)
3. Abre [js/config.js](file:///Users/artdasak/Code/brawlcup/js/config.js) y reemplaza la URL con la de tu endpoint de MockAPI:
   ```javascript
   export const CONFIG = {
     MOCKAPI_BASE_URL: "https://TU-PROYECTO.mockapi.io/api/v1",
     RESOURCE_NAME: "tournaments",
     TOURNAMENT_ID: "", // Puedes dejarlo vacío y crearlo/cargarlo desde la interfaz
     AUTO_SAVE_TO_MOCKAPI: true
   };
   ```

### 2. Uso Local
Si no configuras MockAPI, la aplicación guardará el estado del torneo de forma automática en el almacenamiento local del navegador (`localStorage`), permitiendo utilizarla sin conexión de red.

## Ejecución Local

Para probar o usar la aplicación localmente, puedes abrir directamente el archivo `index.html` en el navegador, o servir el directorio con cualquier servidor local, por ejemplo:

```bash
npx serve .
```
o
```bash
python3 -m http.server 8000
```
