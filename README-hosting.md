# Сайт на asiyatort.ru — хостинг REG.RU

Сайт работает на виртуальном хостинге REG.RU в России. Заявки с телефонами
клиентов сохраняются на этом хостинге (152-ФЗ) и уже оттуда уходят в Telegram.

## Где что находится

| Что | Где |
|---|---|
| Домен `asiyatort.ru` | личный кабинет REG.RU → Домены. Оплачен до 15.09.2027 |
| Хостинг Host-0 | личный кабинет REG.RU → Хостинги. Оплачен до 15.09.2027 |
| Панель хостинга | ispmanager, `https://server121.hosting.reg.ru:1500` |
| Логин и пароль панели, FTP | карточка хостинга → вкладка «Доступы» |
| Папка сайта | `www/asiyatort.ru` |
| Файл с ключами | `www/tort-config.php` — рядом с папкой сайта, не внутри |
| Сохранённые заявки | `www/tort-requests/` |
| PHP | 8.3 (панель → Сайты) |
| DNS-серверы домена | `ns1.hosting.reg.ru`, `ns2.hosting.reg.ru` |
| Код сайта | репозиторий GitHub `strangehul1-design/tort-po-lyubvi`, ветка `main` |

## Как обновляется сайт

Сейчас — архивом, без GitHub:

1. Собрать архив из текущего кода (в корне архива — `index.html`, без папки сверху):
   ```bash
   git archive --format=zip -o tort-site.zip HEAD -- . ':(exclude)api' ':(exclude)tools' ':(exclude)demo-checkout' ':(exclude)success' ':(exclude)fail' ':(exclude).github' ':(exclude)*.md' ':(exclude).gitignore' ':(exclude).nojekyll' ':(exclude).env.example' ':(exclude)backend/config.example.php'
   ```
2. Панель → Менеджер файлов → `www/asiyatort.ru` → «Загрузить» → файл с компьютера.
3. «…» у архива → «Извлечь» → папка `asiyatort.ru` → «Распаковать».
4. Удалить архив из папки сайта, иначе его можно скачать по ссылке.

Файлы `www/tort-config.php` и `www/tort-requests/` лежат вне папки сайта,
архив их не трогает.

### Автоматическая выкладка (выключена)

Можно включить: после каждого пуша в `main` GitHub сам выкладывает изменения
на хостинг по FTP с шифрованием (`.github/workflows/deploy.yml`,
«Выкладка на хостинг»). Загружаются только изменённые файлы.

Для этого в GitHub → Settings → Secrets and variables → Actions:

| Секрет | Значение |
|---|---|
| `FTP_SERVER` | `server121.hosting.reg.ru` |
| `FTP_USERNAME` | логин хостинга из вкладки «Доступы» |
| `FTP_PASSWORD` | пароль из вкладки «Доступы» |
| `FTP_DIR` | `www/asiyatort.ru/` |

И во вкладке Variables: `DEPLOY_ENABLED` = `true`.

Запустить выкладку вручную: GitHub → Actions → «Выкладка на хостинг» → Run workflow.

На хостинг не попадают: `api/` (прежний сервер Cloudflare), `tools/`,
демо-оплата, файлы README.

## Ключи для заявок

Файл `www/tort-config.php` создаётся один раз в файловом менеджере панели.
Содержимое — из `backend/config.example.php`:

- `TELEGRAM_BOT_TOKEN` — токен бота от @BotFather;
- `TELEGRAM_CHAT_ID` — кому слать заявки, несколько через запятую;
- `ADMIN_KEY` — длинный пароль для просмотра списка заявок.

Ключи не кладутся в репозиторий и не отправляются в чат.
Пока файла нет, заявки сохраняются на хостинге, но в Telegram не приходят.

## SSL

Когда домен начнёт открываться (DNS обновляются до суток): панель →
SSL-сертификаты → создать → Let's Encrypt для `asiyatort.ru` и `www.asiyatort.ru`,
включить перенаправление на HTTPS. Сертификат продлевается сам.

## Проверка

| Что открыть | Что должно быть |
|---|---|
| `https://asiyatort.ru` | сайт, замок в адресной строке |
| `https://asiyatort.ru/backend/lib.php` | 403 |
| `https://asiyatort.ru/backend/submit.php` | `{"ok":false,"error":"Метод не поддерживается"}` |
| `https://asiyatort.ru/backend/requests.php?key=ADMIN_KEY` | список заявок |

## Прежний сервер на Cloudflare

Нужен для правок текста через Telegram-бота. Чтобы он принимал запросы
с нового домена (`api/wrangler.toml`, `ALLOWED_ORIGINS`), выложите его:

```bash
cd api
npx wrangler deploy
```
