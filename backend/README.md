# Al-Shaib Housing — Backend API

ASP.NET Core Web API with SQL Server for the Al-Shaib Housing management system.

## Requirements

- .NET 10 SDK
- SQL Server (LocalDB or full instance)

## Database

Connection string in `appsettings.json`:

```
Server=localhost;Database=NameDB;Trusted_Connection=True;TrustServerCertificate=True;Connect Timeout=360;Column Encryption Setting=Enabled;
```

The database is created automatically on first run. No demo business data is seeded — only:

- Default admin user (`admin` / `Admin@123` — change in production)
- Expense category reference list

## Run

```bash
cd backend
dotnet run
```

API: http://localhost:5200

## Sample / test data

In **Development** (`appsettings.Development.json`), sample data is enabled:

```json
"Seed": {
  "SampleData": {
    "Enabled": true,
    "OnlyIfEmpty": true,
    "IncludeDemoUsers": true,
    "AllowAdminReset": true
  }
}
```

### Test accounts

| User | Password | Role |
|------|----------|------|
| admin | Admin@123 | مدير النظام |
| manager | Manager@123 | مدير العمليات |
| accountant | Accountant@123 | المحاسب |

### Admin API (requires JWT)

- `GET /api/admin/seed/status` — counts + config
- `POST /api/admin/seed/run?force=false` — add sample data if empty
- `POST /api/admin/seed/reset` — clear business data and reseed

Or use **الإعدادات** in the frontend UI.

### Seeded scenarios

- Fully paid customer, partial installments, late payer, down-payment only
- Project expenses with partial vendor payments
- Inventory in/out movements
- External expenses + today's transactions for daily report
