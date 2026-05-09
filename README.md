# Face Publisher

PWA para publicar paquetes de imágenes en redes sociales desde Android (probada con Redmi 7).

## Cómo funciona

- **Tab Publicar**: dos botones fijos abajo — `Compartir` y `Siguiente`. Un contador grande indica el paquete actual y el total.
- **Tab Imágenes**:
  - Subí imágenes "default" (encabezados, se incluyen al inicio de cada paquete).
  - Subí imágenes numeradas (`01.jpg`, `02.jpg`, `15.jpg`, …). Se agrupan automáticamente por decena: `00–09`, `10–19`, `20–29`, etc.
  - Botón de reset independiente para cada conjunto (manual, nunca automático).

## Reglas de paquetes

- Cada paquete = imágenes default + entre 1 y 10 imágenes reales.
- Nunca se crea un paquete sin defaults ni un paquete con solo defaults.
- Al subir o resetear imágenes, los paquetes se reconstruyen y el contador vuelve al primero.
- `Siguiente` cicla los paquetes y vuelve al primero al final, sin modificarlos.
- Desde la lista de paquetes (tab Imágenes) o desde la vista previa (tab Publicar) podés eliminar imágenes específicas de un paquete sin afectar a los demás. Esos cambios persisten hasta el próximo reset+upload.
- `Compartir` usa la Web Share API nativa del dispositivo (`navigator.share` con archivos).

## Stack

- Vanilla JS + Vite (sin frameworks).
- IndexedDB para guardar imágenes (Blobs), paquetes y estado.
- Canvas API para resize (1080px lado largo, JPEG q=0.85).
- Service Worker para offline + manifest para instalación.

## Correr en local

```bash
npm install
npm run dev
```

El servidor escucha en todas las interfaces de red (`--host`). En la terminal te muestra una URL tipo `http://192.168.x.x:5173/` — abrila en el celu (mismo WiFi que la PC).

## Instalar como PWA en el celu (Redmi 7)

Para que el "Agregar a pantalla de inicio" funcione bien y la app abra en modo standalone, **necesita HTTPS o localhost**. Tres opciones:

### Opción A — build + servidor con HTTPS

```bash
npm run build
npm run preview
```

Esto sirve `/dist` por HTTP. Para HTTPS local podés usar `vite-plugin-mkcert`:

```bash
npm i -D vite-plugin-mkcert
```

Y agregar al `vite.config.js`:

```js
import mkcert from 'vite-plugin-mkcert';
export default defineConfig({
  plugins: [mkcert()],
  server: { https: true, host: true, port: 5173 },
});
```

### Opción B — túnel HTTPS público

```bash
npx localtunnel --port 5173
# o
npx cloudflared tunnel --url http://localhost:5173
```

### Opción C — desplegar `dist/`

Subí `dist/` a Netlify, Vercel, GitHub Pages, etc. Es estático.

Una vez que abrís la URL en Chrome del celu: menú → "Agregar a pantalla de inicio". Listo, queda como app standalone.

## Estructura

```
face-publisher/
├── index.html
├── public/
│   ├── manifest.webmanifest
│   ├── sw.js
│   └── icons/
│       ├── icon.svg
│       └── icon-maskable.svg
├── src/
│   ├── main.js              # entry, tabs
│   ├── styles.css
│   ├── core/
│   │   ├── db.js            # IndexedDB
│   │   ├── resize.js        # Canvas resize
│   │   ├── grouping.js      # nombre → grupo
│   │   ├── packages.js      # build/edit paquetes
│   │   └── store.js         # bus pub/sub
│   └── ui/
│       ├── publish-tab.js   # Compartir + Siguiente
│       ├── images-tab.js    # Uploads + reset + lista paquetes
│       └── toast.js
└── vite.config.js
```

## Notas técnicas

- **Compartir nativo**: `navigator.share({ files: [...] })`. Chrome Android soporta archivos. Si el dispositivo no lo soporta, sale un toast informando.
- **Botones fijos**: el `.action-bar` está en `position: fixed` con `env(safe-area-inset-bottom)`. No se mueve con scroll, teclado, ni nada.
- **Persistencia**: todo (imágenes, defaults, paquetes, índice actual) vive en IndexedDB. Sobrevive recargas y cierres de app.
- **Reset manual**: las imágenes solo se borran cuando tocás explícitamente "Resetear". Nunca automático.
