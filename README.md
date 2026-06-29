# VILAHEXDOSS CRM

Aplicación HTML/CSS/JavaScript para uso interno:

- Gestión de incidencias
- Seguimiento
- Presupuestos
- Agenda comercial mensual
- Clientes importados por CSV
- Reporte semanal para PDF
- Copia de seguridad JSON

## Abrir

1. Abre la carpeta en Visual Studio Code.
2. Instala la extensión **Live Server**.
3. Botón derecho en `index.html`.
4. Open with Live Server.

## Muy importante

Los datos se guardan en el navegador usando `localStorage`.

Usa el botón **💾 Copia de seguridad** regularmente.
El archivo descargado puede volver a importarse con **📂 Importar copia**.

## Importar clientes

Exporta tu Excel como CSV.

Columnas aceptadas:

codigo,nombre,contacto,telefono,email,direccion


## Versión Supabase presentación

Incluye conexión a Supabase con copia local de seguridad.

Antes de subir a GitHub Pages, ejecuta en Supabase SQL Editor el archivo:

`supabase_policies_presentacion.sql`
