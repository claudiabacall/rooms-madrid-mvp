# Rooms Madrid MVP

Copia independiente del MVP interactivo de Rooms. Conserva las pantallas, estilos, modales, animaciones e interacciones de la versión exportada y no requiere ChatGPT Work ni ChatGPT Sites para ejecutarse.

## Tecnología

- HTML5.
- CSS3 responsive, sin preprocesadores.
- JavaScript nativo, sin frameworks.
- Servidor local opcional en Node.js, sin paquetes externos.
- Imágenes y tipografías incluidas localmente.

No hay base de datos, autenticación ni backend en esta versión. Las interacciones funcionan en el navegador y representan el comportamiento del MVP.

## Estructura

```text
rooms-madrid-mvp/
├── index.html                 # Entrada de la aplicación
├── server.mjs                # Servidor local opcional sin dependencias
├── package.json              # Scripts para ejecutar el proyecto
├── README.md
├── .gitignore
├── .env.example
└── assets/
    ├── css/                  # Estilos generales, mobile, onboarding y feed
    ├── js/
    │   └── app.js            # Lógica e interacciones
    ├── images/               # Imágenes utilizadas por la interfaz
    └── fonts/                # DM Sans y Syne, servidas localmente
```

## Ejecutar en local

### Opción recomendada: Node.js

Necesitas Node.js 18 o superior. No hay dependencias que instalar.

```bash
npm start
```

Después abre:

```text
http://127.0.0.1:4173
```

Para usar otro puerto:

```bash
PORT=8080 npm start
```

### Opción rápida

También puedes abrir `index.html` directamente en un navegador. Se recomienda el servidor local para reproducir un entorno de hosting real y evitar restricciones del protocolo `file://`.

## Archivo de entrada

El archivo principal es `index.html`. Carga los estilos desde `assets/css/`, las fuentes desde `assets/fonts/` y la aplicación desde `assets/js/app.js`.

## Variables de entorno y seguridad

El proyecto no contiene claves, tokens ni credenciales y no necesita variables de entorno. `.env.example` documenta el puerto opcional del servidor. Los archivos `.env` reales están excluidos mediante `.gitignore`.

## Subir a GitHub

Desde la carpeta del proyecto:

```bash
git init
git add .
git commit -m "Initial Rooms MVP"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPOSITORIO.git
git push -u origin main
```

Sustituye `TU-USUARIO` y `TU-REPOSITORIO` por los datos de tu repositorio.

## Publicar en un hosting externo

Es un sitio estático. Puedes publicarlo sin proceso de compilación:

- **GitHub Pages:** configura la rama `main` y la carpeta raíz como origen de Pages.
- **Netlify:** arrastra la carpeta completa o conecta el repositorio; usa `.` como directorio de publicación.
- **Vercel:** importa el repositorio como proyecto estático; no necesita comando de build y el directorio de salida es `.`.
- **Cloudflare Pages:** conecta el repositorio, deja vacío el comando de build y usa `.` como directorio de salida.
- **Cualquier hosting tradicional:** sube `index.html`, `assets/` y el resto de archivos respetando la estructura.

`server.mjs` solo facilita el desarrollo local; no es necesario en un hosting estático.

## Notas

- La exportación no incluye `.openai/hosting.json` ni identificadores internos de ChatGPT Sites.
- Las tipografías y las imágenes visibles se sirven desde el propio proyecto.
- Si añades un backend o servicios externos en el futuro, guarda sus credenciales en variables de entorno y nunca las subas al repositorio.
