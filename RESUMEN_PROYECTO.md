# Resumen del Proyecto: Encuesta PJN-IA

## 1. Objetivo General

Desarrollar una aplicación web completa para realizar una encuesta anónima a los empleados del Poder Judicial de la Nación (PJN) sobre la implementación de Inteligencia Artificial. La aplicación también incluirá un panel de administración para gestionar la encuesta (preguntas, secciones), visualizar resultados en tableros, y permitir el análisis de datos (potencialmente con IA).

## 2. Tecnologías Clave

*   **Frontend y Backend:** Next.js (con App Router, TypeScript)
*   **Base de Datos:** PostgreSQL
*   **ORM:** Prisma
*   **Estilizado:** Tailwind CSS
*   **Contenerización:** Docker y Docker Compose
*   **Autenticación (Administradores):** `next-auth`
*   **Hashing de Contraseñas:** `bcryptjs`

## 3. Estado del Proyecto por Fases

*   **Fase 1: Configuración del Proyecto y Fundación del Backend (Completada)**
    *   Proyecto Next.js inicializado (TypeScript, ESLint, Prettier, Tailwind CSS).
    *   Configuración de Docker y Docker Compose para la aplicación Next.js y la base de datos PostgreSQL.
    *   Prisma ORM configurado, conectado a la base de datos Dockerizada.
    *   Esquema inicial de Prisma con el modelo `User` (para administradores) creado y migración aplicada.

*   **Fase 2: Desarrollo del Backend - Autenticación y API de Usuarios (Completada)**
    *   Instancia reutilizable de Prisma Client (`src/lib/prisma.ts`).
    *   Hashing de contraseñas con `bcryptjs` y script de seed para usuario admin.
    *   Configuración completa de `next-auth` con `CredentialsProvider`, tipos personalizados, variables de entorno.
    *   Página de login (`src/app/admin/login/page.tsx`) y dashboard (`src/app/admin/dashboard/page.tsx`).
    *   `SessionProvider` y middleware (`src/middleware.ts`) para proteger rutas `/admin/*`.
    *   Funcionalidad de Logout.

*   **Fase 3: CRUD de Encuestas (Completada)**
    *   Modelos Prisma: `Survey`, `Section`, `Question`, `QuestionOption`, `Answer`, `AnswerDetail`, `QuestionType`. Migración aplicada.
    *   Endpoints API para Encuestas (`GET`, `POST`, `PUT`, `DELETE` en `/api/surveys` y `/api/surveys/[surveyId]`) protegidos para admin.
    *   UI en Dashboard: Listar, crear, editar (con `EditSurveyModal`) y eliminar encuestas.

*   **Fase 4: CRUD de Secciones (Completada)**
    *   Endpoints API para Secciones (`POST`, `GET` en `/api/surveys/[surveyId]/sections`, `PUT`, `DELETE` en `/api/surveys/[surveyId]/sections/[sectionId]`) protegidos.
    *   Revisión y ajuste de `onDelete` en `schema.prisma` (Cascade y SetNull). Migración aplicada.
    *   Página `src/app/admin/surveys/[surveyId]/manage/page.tsx` para gestionar secciones: listado, añadir, eliminar, editar (con `EditSectionModal`). Enlaces de navegación.

*   **Fase 5: CRUD de Preguntas (Completada)**
    *   Endpoints API para Preguntas:
        *   `/api/surveys/[surveyId]/sections/[sectionId]/questions` (`GET`, `POST`) implementados, incluyendo lógica para creación de opciones en `SINGLE_CHOICE`.
        *   `/api/surveys/[surveyId]/sections/[sectionId]/questions/[questionId]` (`PUT`, `DELETE`) implementados, con manejo de actualización/creación/eliminación de `QuestionOption`.
    *   UI para Gestión de Preguntas en `manage/page.tsx` (Completada):
        *   Endpoint `GET /api/surveys/[surveyId]` modificado para incluir secciones, preguntas y opciones.
        *   Interfaces actualizadas con tipos de `@/generated/prisma`.
        *   Visualización de preguntas (texto, tipo, orden, obligatoriedad, placeholder, opciones) dentro de cada sección.
        *   Funcionalidad completa para **Añadir Pregunta** (con `AddQuestionModal`), incluyendo manejo de opciones (para `SINGLE_CHOICE` y `MULTIPLE_CHOICE`) y campo `placeholder`.
        *   Funcionalidad completa para **Eliminar Pregunta**.
        *   Funcionalidad completa para **Editar Pregunta** (con `EditQuestionModal`), incluyendo manejo de opciones (crear, editar, marcar para eliminar para `SINGLE_CHOICE` y `MULTIPLE_CHOICE`) y campo `placeholder`. Se confirmó que la edición, creación y eliminación de opciones para `MULTIPLE_CHOICE` funciona correctamente tras la refactorización del endpoint PUT.
    *   Resueltos errores de build de Docker, ESLint, y tipado en Route Handlers de Next.js 15.

## 4. Problemas Relevantes Resueltos Durante el Desarrollo

*   Configuración de ESLint en Docker.
*   Conflictos de puertos en Docker.
*   Instalación y uso de `bcryptjs` en el contenedor Docker y script de seed.
*   Conexión de Prisma a la base de datos desde diferentes entornos (host/contenedor).
*   Fallo en `npm install` dentro de Docker debido a `@prisma/engines` (solucionado con `binaryTargets`).
*   Errores de tipado en Route Handlers de Next.js 15.
*   Manejo correcto de respuestas HTTP 204 en API handlers.

## 5. Próximos Pasos

**Hito Actual Superado:** Implementación funcional del login/logout de administrador, protección de rutas, y CRUD completo para Encuestas, Secciones y Preguntas (modelos, API completa y UI en el panel de administración). La aplicación se construye y ejecuta de forma estable. Se ha añadido el campo `slug` a las encuestas, junto con su gestión en el CRUD y la corrección de diversos problemas de build y migración de base de datos.

**Próximo Hito Principal: Implementación de la Interfaz Pública para Responder Encuestas (En Progreso)**

*   **Sub-Hito Alcanzado: Estructura de la Encuesta Pública y API**
    *   Se añadió un campo `slug` (único, string) al modelo `Survey` para URLs públicas amigables.
    *   Se actualizó el CRUD de encuestas (API y UI en dashboard) para incluir la gestión del `slug`.
    *   Se creó el endpoint API `GET /api/public/surveys/[surveySlug]` que devuelve la estructura de una encuesta activa (secciones, preguntas, opciones) para ser consumida públicamente.
    *   Se creó la ruta y archivo base `src/app/survey/[surveySlug]/page.tsx`.
    *   Se implementó la lógica en `src/app/survey/[surveySlug]/page.tsx` para llamar al API y renderizar la estructura básica de la encuesta (títulos, descripciones, textos de preguntas y marcadores de posición para los inputs).
    *   Se creó e integró un modal de Política de Privacidad (`src/components/survey/PrivacyPolicyModal.tsx`) en la página pública de la encuesta.
    *   Resueltos múltiples problemas complejos de build (ESLint, Next.js export fields), migraciones de Prisma (columnas faltantes, drift), y configuración de base de datos Dockerizada para lograr la correcta visualización de la estructura de la encuesta.

*   **Sub-Hito Alcanzado: Interfaz Pública Interactiva y Envío de Respuestas**
    1.  **Desarrollo de Componentes de la Interfaz Pública Completado:**
        *   En `src/app/survey/[surveySlug]/page.tsx`:
            *   Renderizado de inputs adecuados según `question.type` (`TEXT_SHORT`, `TEXT_LONG`, `SINGLE_CHOICE`).
            *   Manejo del estado de las respuestas del usuario (`useState`, `handleInputChange`).
            *   Implementación de `handleSubmit` para prevenir recarga, transformar datos y mostrar mensajes de estado (enviando, éxito, error).
    2.  **Endpoint API para Envío de Respuestas Completado (`POST /api/public/surveys/[surveySlug]/answers`):
        *   Validación del payload de entrada (`surveyId`, `answers`).
        *   Búsqueda y validación de la encuesta activa por `slug`.
        *   Validación exhaustiva de respuestas: obligatoriedad, formato según tipo de pregunta, y validez de opciones seleccionadas.
        *   Uso de `prisma.$transaction` para crear atómicamente el registro `Answer` y los `AnswerDetail` correspondientes.
        *   Manejo de errores y respuestas HTTP adecuadas (201, 400, 404, 500).

*   **Sub-Hito Alcanzado: Feedback Post-Envío y Pruebas Finales de la Interfaz Pública (Completado)**
    1.  **Mejorar Experiencia Post-Envío (Completado):**
        *   Se creó una página de agradecimiento (`/survey/[surveySlug]/thank-you`) y se redirige al usuario tras un envío exitoso.
    2.  **Validación de Campos Obligatorios en Frontend (Completado):**
        *   Se implementó la lógica en `handleSubmit` de `src/app/survey/[surveySlug]/page.tsx` para verificar que todas las preguntas requeridas tengan una respuesta antes de enviar, mostrando un error si no es así.
    3.  **Pruebas Exhaustivas (Completado):**
        *   Se verificaron todos los flujos de envío de respuestas (casos de éxito y error).
        *   Se aseguró la correcta visualización y comportamiento en diferentes navegadores/dispositivos (responsive design básico).
        *   Se validó la integridad de los datos guardados en la base de datos.
        *   Se implementó la mejora visual de la interfaz pública.

**Pasos Posteriores (Siguiente Hito Principal):**
*   **Visualización de resultados y tableros de análisis en el panel de administración (Mejoras Implementadas):**
    *   **Implementación Inicial Completada:** Se ha implementado una página de resultados (`src/app/admin/surveys/[surveyId]/results/page.tsx`) que muestra:
        *   Título de la encuesta e ID.
        *   Número total de respuestas recibidas.
        *   Listado de todas las preguntas de la encuesta, ordenadas.
    *   **Mejoras Implementadas:**
        *   Para preguntas de opción única (`SINGLE_CHOICE`) y opción múltiple (`MULTIPLE_CHOICE`): Se muestran gráficos de barras con la distribución de respuestas por cada opción (usando Recharts). La función `getAggregatedAnswers` se adaptó para procesar ambos tipos de pregunta para este gráfico.
        *   Para preguntas de texto (`TEXT_SHORT`, `TEXT_LONG`): Se implementó paginación para mostrar las respuestas de texto (5 por página) con controles de navegación.
    *   **Próximas Mejoras y Funcionalidades (En Orden de Prioridad Sugerido):**
        1.  **Visualización para `MULTIPLE_CHOICE` (Completada):** Se ha implementado una visualización inicial utilizando gráficos de barras (similar a `SINGLE_CHOICE`). Se considera completada la visualización básica.
        2.  **Visualización para `RATING_SCALE` (Completada):** Se ha implementado la visualización para preguntas de escala de calificación, incluyendo el manejo correcto de opciones y su almacenamiento en la base de datos.
        3.  **Exportación de Datos**: Permitir exportar las respuestas de las encuestas (completas o filtradas) a formatos como CSV o Excel para análisis externo.
        4.  **Mejoras Visuales Adicionales**:
            *   Considerar visualización condensada/expandible para respuestas de texto largas.
            *   Explorar otros tipos de gráficos (ej. torta para `SINGLE_CHOICE` si aplica, o para `MULTIPLE_CHOICE`).
            *   Diseñar y desarrollar una interfaz más elaborada para mostrar los resultados, si se considera necesario.
            *   Añadir funcionalidades de filtrado de resultados (ej. por fecha).
        5.  **Análisis Avanzado (Potencial Integración de IA):**
            *   Explorar Nube de Palabras (Word Cloud) para preguntas de texto libre.
            *   Considerar Análisis de Sentimiento Básico.
            *   Potencial integración de IA más profunda para análisis de respuestas de texto libre.

---
Este resumen se actualizará a medida que avance el proyecto. 