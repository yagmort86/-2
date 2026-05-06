# Chaika Site Exporter for SketchUp

Прямой экспорт из SketchUp на сайт: плагин сохраняет текущую модель в `.glb` и отправляет ее в API сайта.

## Установка

1. В SketchUp откройте `Window > Extension Manager`.
2. Нажмите `Install Extension`.
3. Выберите `chaika_exporter.rbz`.
4. Откройте `Extensions > Chaika Site Exporter > Settings`.
5. Укажите:
   - `API URL`: `http://localhost:3001`
   - `API key`: значение `SKETCHUP_API_KEY`; локально по умолчанию `chaika-admin-local-secret`
   - `Target`: `main` для главной 3D-модели или id товара

## Использование

- `Show product IDs` показывает id товаров для поля `Target`.
- `Upload active model` экспортирует текущую модель в GLB и загружает ее на сайт.

## Сервер

Для отдельного ключа запускайте API так:

```powershell
$env:SKETCHUP_API_KEY="your-secret-key"; npm run dev:api
```

Если `SKETCHUP_API_KEY` не задан, используется текущий локальный `ADMIN_SECRET`.

## Требование

Нужна версия SketchUp с поддержкой экспорта GLB. Если экспорт недоступен, плагин покажет ошибку до загрузки.
