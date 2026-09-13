# Архитектура

## Поток урока
Teacher → lesson/{id} → createAttendanceQr() → qrTokens/{hash} → Student → submitQrAttendance() → lessons/{id}/attendance/{studentId} → Teacher confirm → report.

## Финансы
Manager records payment → students.paymentStatus → daily scheduled recalculation → Dashboard/Finance → Excel/PDF/Print.

## Зарплата
Рекомендуемый расчёт:
- percent: `studentCount × collectedAmount × percent / 100`
- fixed: `studentCount × fixedPerStudent`
Расчёт выполняется только серверной Function для защиты от изменения зарплаты через браузер.

## Роли
Custom Claims:
`role: director | manager | teacher | student | parent`

Профиль:
`users/{uid}`

Не помещайте ФИО, телефон, зарплату и другие профильные поля в Custom Claims — claims должны оставаться маленькими и использоваться для authorization.

## Отчёты
В `reports` хранится финальный snapshot. `lessons.reportStatus` используется как быстрый индекс состояния для scheduler.

## Примечание о Firestore Rules
Rules не являются фильтрами: запрос клиента должен быть совместим с разрешениями rules. Для сложных списков лучше запрашивать только те документы, которые пользователь вправе читать.
