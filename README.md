# Smart Center CRM / LMS — Firebase Serverless

Готовый стартовый GitHub/Firebase-проект для учебного центра.

## Стек
- React + Vite
- Firebase Authentication
- Cloud Firestore
- Cloud Functions 2nd gen
- Firebase Storage
- Firebase App Check для чувствительных callable-функций
- Excel/CSV: SheetJS + PapaParse
- PDF: jsPDF
- GitHub Actions → Firebase Hosting

## Роли
`director` — полный доступ, персонал, зарплата, финансы, аналитика.
`manager` — группы, ученики, расписание, платежи.
`teacher` — свои группы/уроки, отчёты, QR-посещаемость.
`student` / `parent` — предусмотрены для расширения.

Роль для авторизации хранится в Firebase Auth Custom Claims. Профиль и остальные данные находятся в `users/{uid}`. Custom Claims предназначены именно для доступа, а не для хранения профиля.

## Запуск
1. Создайте Firebase project.
2. Включите Authentication → Email/Password.
3. Создайте Firestore и Storage.
4. Скопируйте `.env.example` в `.env` и заполните Firebase Web App config.
5. `npm install`
6. `npm run dev`
7. Установите Firebase CLI: `npm i -g firebase-tools`
8. `firebase login`
9. `firebase use <PROJECT_ID>`
10. `cd functions && npm install && cd ..`
11. `firebase deploy --only firestore:rules,firestore:indexes,storage,functions`

Для production используйте App Check и после проверки включите enforcement.

## GitHub Pages / Firebase Hosting
Этот проект уже содержит workflow для Firebase Hosting. Если нужен именно GitHub Pages как фронтенд, замените deploy job на GitHub Pages и оставьте Firebase как backend. Firebase Web config не является секретом; секретными должны быть service-account credentials и серверные ключи.

## Модель данных

### users/{uid}
`role, displayName, email, phone, photoUrl, active, createdAt, updatedAt`

### groups/{groupId}
`name, teacherIds[], managerUid, schedule[], monthlyFee, active, createdAt`

`groups/{groupId}/members/{studentId}`:
`studentId, joinedAt, active`

### students/{studentId}
`fullName, phone, email, groupId, groupName, parentUid, parentName, parentPhone, monthlyFee, paymentStatus, paymentDueAt, active, createdAt`

### lessons/{lessonId}
`groupId, teacherId, scheduledStart, scheduledEnd, actualStart, actualEnd, topic, homework, reportStatus, reportSubmittedAt`

`lessons/{lessonId}/attendance/{studentId}`:
`studentId, status(pending/present/absent/excused), source(qr/manual), scannedAt, confirmedAt, confirmedBy`

### payments/{paymentId}
`studentId, studentName, groupId, amount, currency, method, period, status, createdAt, createdBy`

### reports/{reportId}
`lessonId, teacherId, topic, homework, attendanceSummary, status, scheduledEnd, submittedAt`

### notifications/{notificationId}
`recipientUid, type, lessonId, title, message, read, createdAt`

### payroll/{payrollId}
`teacherId, period, calculationType(percent/fixed), studentCount, baseAmount, percent, calculatedAmount, status`

### qrTokens/{hash}
Только серверная коллекция. Клиенту чтение/запись запрещены.

## QR
QR живёт 20 секунд и содержит только `lessonId + token`.
Сканирование выполняется через callable Function:
1. пользователь должен быть авторизован;
2. сервер хеширует token;
3. проверяет существование, урок, срок и одноразовость;
4. проверяет, что пользователь ещё не отметился;
5. создаёт attendance со статусом `pending`;
6. teacher подтверждает присутствие.

Важно: веб-QR невозможно сделать абсолютно защищённым от фотографии экрана. Поэтому применены короткий TTL, одноразовый token, App Check, Auth и серверная проверка. При необходимости можно добавить обязательную геолокацию/локальную сеть/контроль устройства как дополнительные сигналы.

## Контроль отчёта 60 минут
Scheduled Function запускается каждые 5 минут. Она находит уроки:
`scheduledEnd <= now - 60 min` и `reportStatus == pending`.
После этого создаёт уведомления директору и менеджеру и меняет статус на `alerted`.

## Оплата: зелёный / жёлтый / красный
- зелёный: `paymentStatus=paid`;
- жёлтый: срок оплаты через 0–3 дня;
- красный: срок уже прошёл;
- серый: нет установленной даты.

Менеджер видит родителя рядом с учеником и кнопку `Позвонить` через `tel:`.

## Импорт
`Students` принимает `.xlsx/.xls/.csv`, читает файл в браузере и создаёт документы Firestore. Для массового production-импорта рекомендуется делать пакетные записи/Cloud Function, а не тысячи одиночных запросов.

## Важно перед production
- Не выдавайте клиенту service account JSON.
- Включите App Check.
- Настройте резервное копирование/экспорт Firestore.
- Протестируйте Rules Emulator.
- Для зарплаты храните расчётные документы отдельно от публичного профиля учителя.
