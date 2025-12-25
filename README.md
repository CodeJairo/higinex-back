# Higinex Backend

API REST para catalogo, precios, inventario y ordenes. Autenticacion JWT + refresh cookie y notificaciones por email.

## Arranque rapido

1. `pnpm install`
2. Copia `.env.development` a `.env` y ajusta `DATABASE_URL`.
3. `docker compose up -d` (opcional)
4. `npx prisma migrate dev`
5. `pnpm start:dev`

## URLs

- Base: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/api`

## Auth (frontend)

- `POST /auth/login` devuelve `accessToken` y setea cookie httpOnly con refresh.
- En requests protegidas: `Authorization: Bearer <accessToken>`.
- `POST /auth/refresh` renueva el access token (usa cookie).
- `POST /auth/logout` limpia la cookie de refresh.
- `GET /auth/me` devuelve el usuario actual.
- No se permite login sin `email` verificado.

## Verificacion de email (link)

- Se envia un link de verificacion con expiracion de 10 minutos.
- Reenvio: cooldown 60s; max 3 links por hora.
- `POST /auth/email/resend` `{ email }`
- `GET /auth/email/verify?token=...`

## Registro

- `POST /auth/register` (solo ADMIN). Envia link de verificacion al email.

## Notas

- Si SMTP no esta configurado, no se envian correos (se registra warning en logs).
- Si frontend y backend usan dominios distintos, habilita `CORS_ORIGINS` y envia `withCredentials`.
- Para el link de verificacion, configura `EMAIL_VERIFY_URL` con `{token}`.
