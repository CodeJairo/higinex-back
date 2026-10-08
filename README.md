# Higinex Backend

<div align="center">

**API REST empresarial para la gestión B2B de catálogo, inventario, precios, órdenes y facturación**

[![NestJS](https://img.shields.io/badge/NestJS-11.0-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-Postgres_17-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Swagger](https://img.shields.io/badge/OpenAPI-Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)](https://swagger.io/)

</div>

---

## Descripción General

**Higinex Backend** es la API REST central del ecosistema Higinex. Proporciona una arquitectura robusta, transaccional y modular desarrollada sobre **NestJS 11** y **Prisma ORM**, cubriendo todas las operaciones comerciales del canal mayorista: desde la administración de productos y acuerdos de precios diferenciados, hasta el control de stock en tiempo real, el procesamiento de pedidos, la generación automatizada de facturas PDF y las notificaciones por correo.

---

## Arquitectura y Módulos de Dominio

La aplicación está organizada siguiendo los principios de arquitectura modular y capas de NestJS (Controlador → Servicio → Capa de Datos Prisma):

| Módulo | Dominio y Funcionalidades |
|---|---|
| **auth & users** | Autenticación JWT con rotación mediante `refreshToken` en cookies `httpOnly`, verificación de email (tokens temporales), reseteo de clave y control de roles (`ADMIN`, `CUSTOMER`). |
| **customers** | Gestión de clientes corporativos, perfiles comerciales y libretas de direcciones de entrega (`CustomerAddress`). |
| **products** | Catálogo multivariante (presentaciones, bultos, códigos SKU/barras), clasificación por categorías y gestión de imágenes. |
| **inventory** | Control de existencias físicas por variante, registro de movimientos (entradas, salidas, ajustes manuales) y trazabilidad completa. |
| **pricing** | Motor comercial B2B: listas de precios personalizadas y acuerdos de precios contratados específicamente por cliente. |
| **orders** | Ciclo de vida de órdenes comerciales, reserva atómica de existencias mediante transacciones de base de datos y tracking de despacho. |
| **finance** | Procesamiento y conciliación de pagos asociados a órdenes, balance y gestión de reembolsos. |
| **notifications** | Envío de correos transaccionales (Nodemailer / Resend / SendGrid con plantillas Handlebars) y renderizado de facturas PDF con Puppeteer headless. |
| **analytics** | Consolidado de métricas de ventas, productos de mayor rotación y reportes financieros. |
| **demo** | Endpoints y datos precargados para demostraciones guiadas y pruebas del frontend en entornos seguros. |

---

## Requisitos Previos

- **Node.js:** Versión 20.x o superior
- **pnpm:** Versión 10+ (`npm install -g pnpm`)
- **Docker & Docker Compose:** Para la base de datos PostgreSQL 17 local (o una instancia PostgreSQL accesible)

---

## Instalación y Puesta en Marcha

### 1. Clonar el repositorio

```bash
git clone https://github.com/MotoStock/higinex-back.git
cd higinex-back
```

### 2. Instalar dependencias

```bash
pnpm install
```

### 3. Iniciar la base de datos local (Docker)

```bash
docker compose up -d
```
> Esto levantará un contenedor PostgreSQL 17 en el puerto `5432`.

### 4. Configurar variables de entorno

Copia el archivo de plantilla `.env.development` a `.env`:

```bash
cp .env.development .env
```

Ajusta los parámetros necesarios:

```ini
# Servidor y Entorno
PORT=3000
NODE_ENV=development

# Base de Datos (PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/higinex_db?schema=public"

# Seguridad y Autenticación
JWT_SECRET=tu_secreto_jwt_super_seguro
JWT_REFRESH_SECRET=tu_secreto_refresh_super_seguro
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGINS=http://localhost:4200

# Documentación Swagger (Protección Basic Auth)
SWAGGER_USER=admin
SWAGGER_PASSWORD=admin_password

# Notificaciones y Correos (Resend / SMTP)
EMAIL_PROVIDER=RESEND
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_tu_api_key_aqui
EMAIL_FROM=onboarding@resend.dev
```

### 5. Preparar la Base de Datos (Prisma)

Genera el cliente tipado de Prisma y aplica las migraciones:

```bash
# Generar cliente
npx prisma generate

# Aplicar migraciones pendientes
npx prisma migrate dev
```

*(Opcional)* Cargar semillas de datos iniciales:

```bash
pnpm run seed           # Semilla completa de prueba
pnpm run seed:admin     # Solo usuario administrador inicial
pnpm run seed:data      # Datos de prueba para catálogo y clientes
```

### 6. Iniciar el Servidor de Desarrollo

```bash
pnpm run start:dev
```

- **API REST Base:** `http://localhost:3000/api/v1`
- **Documentación Swagger:** `http://localhost:3000/docs` *(Autenticada con las credenciales de Swagger)*

---

## Scripts Disponibles

| Comando | Acción |
|---|---|
| `pnpm run start:dev` | Inicia el servidor en modo desarrollo con recarga en caliente |
| `pnpm run build` | Compila TypeScript y genera el cliente de Prisma para producción |
| `pnpm run start:prod` | Ejecuta la aplicación compilada en producción |
| `pnpm run lint` | Analiza y corrige estilos de código con ESLint |
| `pnpm run format` | Aplica formato uniforme de código con Prettier |
| `pnpm run test` | Ejecuta las pruebas unitarias con Jest |
| `pnpm run test:e2e` | Ejecuta pruebas End-to-End |
| `npx prisma studio` | Abre el visor web interactivo de base de datos de Prisma |

---

## Integración y Despliegue

- **Entorno Productivo (API):** `https://higinex-back-production.up.railway.app/api/v1`
- **Documentación Productiva:** `https://higinex-back-production.up.railway.app/docs`
- **Frontend Vinculado:** [higinex-front](https://github.com/CodeJairo/higinex-front)

---

## Autoría y Créditos

Desarrollado para el ecosistema **Higinex**.
