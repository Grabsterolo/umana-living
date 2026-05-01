# Umana Living — sitio estático (Jekyll)

Sitio modular con datos en `_data/`, colección `articulos` en `_articulos/` y estilos/scripts en `assets/`. La edición en equipo puede hacerse con [CloudCannon](https://cloudcannon.com/) (Data Editor para `_data/site.yml` y `_data/home.yml`, editor de colección para artículos).

## Desarrollo local

Requisitos: Ruby 3.x y Bundler.

```bash
bundle install
bundle exec jekyll serve
```

Abre `http://127.0.0.1:4000` (o la URL que indique Jekyll).

## Build de producción

```bash
bundle exec jekyll build
```

Salida en `_site/`. Configura `url` y `baseurl` en `_config.yml` según el dominio (p. ej. Cloudflare Pages).

## Cloudflare Pages

- **Build command:** `bundle exec jekyll build`
- **Build output directory:** `_site`
- **Environment:** fija la versión de Ruby acorde al `Gemfile` / `Gemfile.lock`.

## CloudCannon

Conecta el repositorio y elige Jekyll como generador. El archivo [`cloudcannon.config.yml`](cloudcannon.config.yml) define la carpeta de subidas `imagenes/`, la colección `_articulos` y los datos globales. Puedes ajustar esquemas y orden de navegación desde el panel de CloudCannon.

## Decap / Netlify CMS

La carpeta `admin/` (Decap CMS) se eliminó en favor del flujo de edición en CloudCannon. Si necesitas Decap de nuevo, tendrías que restaurar `admin/config.yml` desde el historial de Git y apuntar la colección a `_articulos/`.
