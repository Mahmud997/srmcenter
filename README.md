# Smart Center CRM / LMS — GitHub Ready v3

Современный светлый frontend для CRM/LMS учебного центра на Firebase.

## Что внутри
- Firebase Authentication
- Firestore real-time данные
- Role-based интерфейс
- Dashboard директора
- Ученики и родители
- Группы и расписание
- Контроль оплат с green/yellow/red debt-control
- QR attendance flow: QR → pending → confirmation
- Финансы: Excel / PDF / печать UI
- Аналитика посещаемости и финансов
- Отчёты преподавателей и контроль таймера
- Сотрудники и роли
- Уведомления
- Responsive desktop/tablet/mobile дизайн

## Запуск
```bash
npm install
npm run dev
```

Для GitHub Pages используйте GitHub Actions из `.github/workflows/deploy.yml` и заполните Firebase env-переменные.

> Frontend подключается к существующему Firebase backend. Кнопки экспорта/CRUD можно связать с существующими Cloud Functions по мере подключения конкретной бизнес-логики.
