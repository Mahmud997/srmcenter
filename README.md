# Smart Center CRM / LMS

Современный светлый frontend для CRM/LMS учебного центра на **Firebase** (Auth, Firestore, Storage, Cloud Functions).

## Возможности

- Firebase Authentication + role-based UI (director / manager / teacher / student / parent)
- Firestore real-time данные
- Dashboard директора
- Ученики и родители
- Группы и расписание
- Контроль оплат (green / yellow / red debt-control)
- QR attendance: QR → pending → confirmation
- Финансы: Excel / PDF / печать
- Аналитика посещаемости и финансов
- Отчёты преподавателей и контроль таймера
- Сотрудники и роли
- Уведомления
- Responsive desktop / tablet / mobile

Без настроенного Firebase приложение запускается в **демо-режиме** с тестовыми данными.

## Быстрый старт

```bash
cp .env.example .env
# заполните VITE_FIREBASE_* (можно оставить пустым для демо)

npm install
npm run dev
```

Откройте http://localhost:5173

### Демо-режим

Если переменные Firebase не заданы, на экране входа можно ввести любой email/пароль (или оставить пустыми) и нажать «Войти» — откроется интерфейс с демо-данными.

## Структура

```
├── src/                 # React + Vite frontend
├── functions/           # Cloud Functions (Node 22, asia-southeast1)
├── public/              # Статика (CSV-шаблон)
├── docs/ARCHITECTURE.md
├── firestore.rules
├── storage.rules
├── firestore.indexes.json
├── firebase.json
└── .github/workflows/deploy.yml
```

## Firebase

1. Создайте проект в [Firebase Console](https://console.firebase.google.com/).
2. Включите Authentication (Email/Password), Firestore, Storage.
3. Скопируйте web-config в `.env` (см. `.env.example`).
4. Разверните правила и functions:

```bash
firebase login
firebase use <project-id>
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

Регион functions: **asia-southeast1**.

Custom claims (`role`) выставляются через callable `setUserRole` (только director).

## Deploy (GitHub Actions → Firebase Hosting)

Workflow: `.github/workflows/deploy.yml` (push в `main`).

Нужны secrets в репозитории:

| Secret | Описание |
|--------|----------|
| `VITE_FIREBASE_API_KEY` | … |
| `VITE_FIREBASE_AUTH_DOMAIN` | … |
| `VITE_FIREBASE_PROJECT_ID` | … |
| `VITE_FIREBASE_STORAGE_BUCKET` | … |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | … |
| `VITE_FIREBASE_APP_ID` | … |
| `VITE_FIREBASE_MEASUREMENT_ID` | (опционально) |
| `FIREBASE_SERVICE_ACCOUNT` | JSON service account для deploy |

```bash
# локальный preview build
npm run build
npm run preview
```

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Vite dev-server |
| `npm run build` | production build → `dist/` |
| `npm run preview` | preview production build |

## Лицензия

Private / учебный проект. При публикации укажите свою лицензию.
