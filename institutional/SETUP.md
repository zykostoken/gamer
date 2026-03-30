# Paquete Institucional — Setup Guide

## Esto es la plantilla para Escenario B (sistema integral)

Reemplazar los siguientes placeholders con los datos de la institución:

| Placeholder | Reemplazar con | Ejemplo |
|-------------|---------------|---------|
| INSTITUTION_REPO_NAME | Nombre del repo GitHub | mi-clinica |
| INSTITUTION_SUPABASE_PROJECT_ID | ID del proyecto Supabase | abcdefghijklmnop |
| INSTITUTION_DOMAIN | Dominio web | miclinica.com.ar |
| INSTITUTION_NAME | Nombre de la institución | Centro de Salud Mental XYZ |
| NOMBRE_INSTITUCION | Nombre para mostrar | Centro XYZ |
| TIPO_INSTITUCION | Tipo legal | Clínica Privada / Hospital Público / Consultorio |
| CUIT_INSTITUCION | CUIT/RUT/NIF | 30-12345678-9 |
| CIUDAD_INSTITUCION | Ciudad, Provincia | Córdoba, Córdoba |

## Contenido del paquete

- `hce/` — Historia Clínica Electrónica (firma digital, hash chain)
- `gestion-pacientes/` — Portal de internos y externos
- `telemedicina/` — Daily.co integration
- `netlify-functions/` — Backend serverless (auth, admin, HCE, pagos)
- `migrations/` — 42 migraciones SQL para Supabase
- `paquete-ministerio/` — Documentación de compliance (ReNaPDiS, Ley 26.529)
- `sql/` — Scripts adicionales (color psychology, game sessions, telemetry)

## Deploy

1. Crear Supabase project → reemplazar INSTITUTION_SUPABASE_PROJECT_ID
2. Correr migrations/ en orden
3. Copiar netlify-functions/ al repo
4. Configurar variables de entorno (Daily.co, MercadoPago, SMTP)
5. Deploy en Netlify
6. El módulo gaming (ZYKOS) ya está incluido en el repo padre
