# Лендинг металлокаркасов лестниц

Vite + React + GSAP. Контент вынесен в `src/content`.

## Запуск

```bash
npm install
npm run dev
```

## Галереи работ

1. Положите изображения в `public/gallery`.
2. Добавьте объект в `src/content/workGalleries.js`.
3. Укажите `cover: "/gallery/имя-файла.jpg"`.

## Geo SEO блог

Новые статьи добавляются в `src/content/blogPosts.js`: город, slug, title, excerpt, keywords. Секции автоматически подтянутся на лендинг.
