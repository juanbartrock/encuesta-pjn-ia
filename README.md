# Encuesta PJN-IA

## 1. Descripción del Proyecto

Aplicación web completa para realizar una encuesta anónima a los empleados del Poder Judicial de la Nación (PJN) sobre la implementación de Inteligencia Artificial. La aplicación también incluye un panel de administración para gestionar la encuesta (preguntas, secciones), visualizar resultados en tableros, y permitir el análisis de datos.

Para un seguimiento detallado del progreso, funcionalidades implementadas y próximos pasos, consulta el archivo [RESUMEN_PROYECTO.md](RESUMEN_PROYECTO.md).

## 2. Tecnologías Clave

*   **Frontend y Backend:** Next.js (con App Router, TypeScript)
*   **Base de Datos:** PostgreSQL
*   **ORM:** Prisma
*   **Estilizado:** Tailwind CSS
*   **Contenerización:** Docker y Docker Compose
*   **Autenticación (Administradores):** `next-auth`
*   **Hashing de Contraseñas:** `bcryptjs`

## 3. Getting Started

### Prerrequisitos

*   Docker y Docker Compose instalados.
*   Node.js y npm/yarn/pnpm (opcional, para gestión de dependencias fuera de Docker si es necesario).

### Configuración y Ejecución

1.  **Clonar el repositorio (si aún no lo has hecho):**
    ```bash
    git clone <url-del-repositorio>
    cd encuesta-pjn-ia
    ```

2.  **Crear archivo `.env`:**
    Copia el archivo `.env.example` (si existe) a `.env` y configura las variables de entorno necesarias. Como mínimo, necesitarás:
    ```env
    DATABASE_URL="postgresql://user:password@db:5432/mydb?schema=public"
    NEXTAUTH_URL="http://localhost:3000"
    NEXTAUTH_SECRET="TU_NEXTAUTH_SECRET_AQUI" # Genera un secreto seguro

    # Credenciales del administrador por defecto (usadas en el script de seed)
    ADMIN_EMAIL="admin@example.com"
    ADMIN_PASSWORD="adminpassword"
    ```
    Asegúrate de que `TU_NEXTAUTH_SECRET_AQUI` sea reemplazado por una cadena aleatoria segura. Puedes generar una con `openssl rand -hex 32`.

3.  **Levantar los servicios con Docker Compose:**
    Desde la raíz del proyecto, ejecuta:
    ```bash
    docker-compose up -d --build
    ```
    Esto construirá las imágenes (si es la primera vez o si hay cambios en `Dockerfile` o `package.json`) y levantará los contenedores de la aplicación Next.js y la base de datos PostgreSQL.

4.  **Aplicar migraciones de Prisma y seed de datos (si es necesario):**
    Una vez que los contenedores estén en funcionamiento, ejecuta los siguientes comandos para inicializar la base de datos:
    ```bash
    docker-compose exec app npx prisma migrate dev --name init
    docker-compose exec app npx prisma db seed
    ```
    El script de seed (ubicado en `prisma/seed.ts`) creará un usuario administrador por defecto con las credenciales especificadas en tu archivo `.env`.

5.  **Acceder a la aplicación:**
    *   **Interfaz Pública de Encuestas:** (Aún por definir la URL base, pero generalmente `http://localhost:3000/survey/[surveySlug]`)
    *   **Panel de Administración:** `http://localhost:3000/admin/login`
        *   Usa las credenciales definidas en tu `.env` (o las del script de seed) para acceder.

### Comandos Útiles de Docker Compose

*   **Ver logs:** `docker-compose logs -f [nombre-del-servicio]` (ej. `docker-compose logs -f app`)
*   **Detener servicios:** `docker-compose down`
*   **Ejecutar un comando dentro de un contenedor:** `docker-compose exec <nombre-del-servicio> <comando>` (ej. `docker-compose exec app bash`)

## 4. Estructura del Proyecto (Simplificada)

*   `src/app/admin/`: Contiene las páginas y lógica del panel de administración.
*   `src/app/api/`: Contiene los Route Handlers (endpoints API) de Next.js.
    *   `src/app/api/surveys/`: Endpoints para la gestión de encuestas, secciones, preguntas.
    *   `src/app/api/public/`: Endpoints para la interfaz pública de encuestas.
*   `src/app/survey/`: Contiene las páginas para responder las encuestas.
*   `src/components/`: Componentes reutilizables de React.
*   `src/lib/`: Librerías y utilidades (Prisma client, authOptions, etc.).
*   `prisma/`: Contiene el esquema de la base de datos (`schema.prisma`), migraciones y el script de seed.
*   `docker-compose.yml`: Definición de los servicios Docker.
*   `Dockerfile`: Instrucciones para construir la imagen Docker de la aplicación Next.js.

## 5. Aprender Más sobre Next.js

Para aprender más sobre Next.js, echa un vistazo a los siguientes recursos:

- [Documentación de Next.js](https://nextjs.org/docs)
- [Aprende Next.js (Tutorial Interactivo)](https://nextjs.org/learn)

Puedes revisar [el repositorio de Next.js en GitHub](https://github.com/vercel/next.js).

## 6. Despliegue

(Esta sección se puede completar más adelante con instrucciones específicas de despliegue si es necesario)
