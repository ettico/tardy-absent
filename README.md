# מערכת איחורים וחיסורים

מערכת לניהול איחורים, חיסורים ושחרורים של תלמידות בתיכון, עם תמיכה במספר מוסדות (multi-tenant).

## מבנה הפרויקט

- `server/` — צד שרת: Node.js + Express + TypeScript + Prisma (SQLite לפיתוח, ניתן לעבור ל-PostgreSQL להפעלה בפועל)
- `client/` — צד לקוח: React + TypeScript + Vite

## הרצה מקומית

### שרת

```bash
cd server
cp .env.example .env
npm install
npx prisma migrate dev
npm run seed      # יוצר מוסד דמו + משתמשים לדוגמה
npm run dev        # http://localhost:4000
```

משתמשי דמו לאחר seed:
- `admin` / `admin123` — מנהלת מערכת
- `secretary` / `secretary123` — מזכירה
- `principal` / `principal123` — מנהלת בית ספר

### לקוח

```bash
cd client
npm install
npm run dev         # http://localhost:5173, מתחבר לשרת דרך proxy
```

## הרשאות

- **מנהלת מערכת (SYSTEM_ADMIN)** — גלובלית, לא שייכת למוסד מסוים. מנהלת מוסדות, רושמת מזכירות ומנהלות בית ספר, ומוסיפה שכבות גיל.
- **מזכירה (SECRETARY)** — מוגבלת למוסד שלה. מנהלת כיתות ותלמידות, רושמת איחורים/חיסורים/שחרורים.
- **מנהלת בית ספר (PRINCIPAL)** — מוגבלת למוסד שלה. מקבלת התראות במייל כשתלמידה מאבדת רשות כניסה לכיתה.

## הערות ליישום בפועל (לפני עלייה לאוויר)

- יש להגדיר פרטי SMTP אמיתיים ב-`server/.env` כדי שהתראות המייל למנהלת יישלחו בפועל (כרגע הן רק נרשמות ביומן השרת).
- מומלץ לעבור מ-SQLite ל-PostgreSQL לפני הפעלה אמיתית מרובת מוסדות (שינוי `provider` ב-`schema.prisma`).
- יש להחליף את `JWT_SECRET` בסוד אקראי וחזק.
