using AlShaibHousing.Api.Configuration;
using AlShaibHousing.Api.Data;
using AlShaibHousing.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AlShaibHousing.Api.Services;

public class SampleDataSeeder(AppDbContext db, IOptions<SeedOptions> seedOptions)
{
    private SeedOptions Options => seedOptions.Value;
    public async Task<SeedResult> SeedAsync(bool force = false, CancellationToken ct = default)
    {
        if (!Options.SampleData.Enabled)
            return SeedResult.Skipped("Sample data seeding is disabled in configuration.");

        if (!force && Options.SampleData.OnlyIfEmpty && await db.Projects.AnyAsync(ct))
            return SeedResult.Skipped("Database already contains projects. Use force=true to reseed.");

        if (force)
            await ClearBusinessDataAsync(ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var projects = await SeedProjectsAsync(today, ct);
        await SeedCustomersAndPaymentsAsync(projects, today, ct);
        await SeedProjectExpensesAsync(projects, today, ct);
        await SeedInventoryAsync(projects, today, ct);
        await SeedExternalExpensesAsync(today, ct);

        if (Options.SampleData.IncludeDemoUsers)
            await SeedDemoUsersAsync(ct);

        await db.SaveChangesAsync(ct);

        return SeedResult.Success(await GetCountsAsync(ct));
    }

    public async Task ClearBusinessDataAsync(CancellationToken ct = default)
    {
        var adminUser = Options.AdminUser.ToLowerInvariant();

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.CustomerPayments.ExecuteDeleteAsync(ct);
        await db.ProjectExpensePayments.ExecuteDeleteAsync(ct);
        await db.ProjectExpenses.ExecuteDeleteAsync(ct);
        await db.InventoryMovements.ExecuteDeleteAsync(ct);
        await db.Customers.ExecuteDeleteAsync(ct);
        await db.ExternalExpenses.ExecuteDeleteAsync(ct);
        await db.InventoryItems.ExecuteDeleteAsync(ct);
        await db.Projects.ExecuteDeleteAsync(ct);
        await db.Users.Where(u => u.UserName != adminUser).ExecuteDeleteAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task<Dictionary<string, int>> GetCountsAsync(CancellationToken ct = default) => new()
    {
        ["users"] = await db.Users.CountAsync(ct),
        ["projects"] = await db.Projects.CountAsync(ct),
        ["customers"] = await db.Customers.CountAsync(ct),
        ["customer_payments"] = await db.CustomerPayments.CountAsync(ct),
        ["project_expenses"] = await db.ProjectExpenses.CountAsync(ct),
        ["project_expense_payments"] = await db.ProjectExpensePayments.CountAsync(ct),
        ["inventory_items"] = await db.InventoryItems.CountAsync(ct),
        ["inventory_movements"] = await db.InventoryMovements.CountAsync(ct),
        ["external_expenses"] = await db.ExternalExpenses.CountAsync(ct),
        ["categories"] = await db.Categories.CountAsync(ct),
    };

    private async Task<List<Project>> SeedProjectsAsync(DateOnly today, CancellationToken ct)
    {
        var projects = new List<Project>
        {
            new() { Name = "إسكان النخيل", Location = "عمان — طبربور", OwnerName = "أبو خالد الشايب", Notes = "مشروع سكني — 24 وحدة", CreatedAt = today.AddMonths(-8).ToDateTime(TimeOnly.MinValue) },
            new() { Name = "مجمع الياسمين", Location = "الزرقاء — الضليل", OwnerName = "محمد الشايب", Notes = "عمارات 5 طوابق", CreatedAt = today.AddMonths(-6).ToDateTime(TimeOnly.MinValue) },
            new() { Name = "عطاءات الصفا", Location = "إربد — الحي الشرقي", OwnerName = "خالد الشايب", Notes = "فلل مستقلة", CreatedAt = today.AddMonths(-4).ToDateTime(TimeOnly.MinValue) },
            new() { Name = "مشروع الواحة", Location = "المفرق", OwnerName = "عبدالله الشايب", Notes = "قيد الإنشاء", CreatedAt = today.AddMonths(-2).ToDateTime(TimeOnly.MinValue) },
        };

        db.Projects.AddRange(projects);
        await db.SaveChangesAsync(ct);
        return projects;
    }

    private async Task SeedCustomersAndPaymentsAsync(List<Project> projects, DateOnly today, CancellationToken ct)
    {
        var p1 = projects[0].Id;
        var p2 = projects[1].Id;
        var p3 = projects[2].Id;

        var customers = new List<Customer>
        {
            // Fully paid scenario
            new() { Name = "أحمد محمود", Phone = "0791234567", ProjectId = p1, TotalAmount = 45000, DownPayment = 5000, MonthlyInstallment = 2000, StartDate = today.AddMonths(-10), Notes = "دفع كامل" },
            // Partial — active installments
            new() { Name = "سارة يوسف", Phone = "0789876543", ProjectId = p1, TotalAmount = 52000, DownPayment = 8000, MonthlyInstallment = 2500, StartDate = today.AddMonths(-8) },
            // Late — few payments only
            new() { Name = "عمر حسن", Phone = "0775551234", ProjectId = p2, TotalAmount = 38000, DownPayment = 3000, MonthlyInstallment = 1500, StartDate = today.AddMonths(-12) },
            // New — down payment only
            new() { Name = "ليلى خالد", Phone = "0798887766", ProjectId = p2, TotalAmount = 41000, DownPayment = 10000, MonthlyInstallment = 1800, StartDate = today.AddMonths(-1) },
            // No project linked
            new() { Name = "محمود عيسى", Phone = "0782223344", ProjectId = null, TotalAmount = 25000, DownPayment = 0, MonthlyInstallment = 1200, StartDate = today.AddMonths(-3) },
            // Villa — large contract
            new() { Name = "فاطمة الزعبي", Phone = "0796665544", ProjectId = p3, TotalAmount = 95000, DownPayment = 15000, MonthlyInstallment = 4000, StartDate = today.AddMonths(-5) },
            new() { Name = "ياسر القيسي", Phone = "0771112233", ProjectId = p3, TotalAmount = 88000, DownPayment = 12000, MonthlyInstallment = 3500, StartDate = today.AddMonths(-4) },
        };

        db.Customers.AddRange(customers);
        await db.SaveChangesAsync(ct);

        var payments = new List<CustomerPayment>
        {
            // أحمد — fully paid (down + installments)
            Pay(customers[0], p1, 5000, today.AddMonths(-10), "كاش", "أبو خالد", "دفعة أولى"),
            Pay(customers[0], p1, 2000, today.AddMonths(-9), "تحويل بنكي", "أبو خالد"),
            Pay(customers[0], p1, 2000, today.AddMonths(-8), "كاش", "أبو خالد"),
            Pay(customers[0], p1, 36000, today.AddMonths(-2), "شيك", "أبو خالد", "تسديد كامل المتبقي"),

            // سارة — partial
            Pay(customers[1], p1, 8000, today.AddMonths(-8), "كاش", "محمد", "دفعة أولى"),
            Pay(customers[1], p1, 2500, today.AddMonths(-7), "كاش", "محمد"),
            Pay(customers[1], p1, 2500, today.AddMonths(-6), "فيزا", "محمد"),
            Pay(customers[1], p1, 2500, today.AddMonths(-5), "كاش", "محمد"),
            Pay(customers[1], p1, 2500, today.AddMonths(-4), "تحويل بنكي", "محمد"),

            // عمر — late (2 payments only)
            Pay(customers[2], p2, 3000, today.AddMonths(-12), "كاش", "خالد", "دفعة أولى"),
            Pay(customers[2], p2, 1500, today.AddMonths(-10), "كاش", "خالد"),

            // ليلى — down only
            Pay(customers[3], p2, 10000, today.AddMonths(-1), "تحويل بنكي", "محمد", "دفعة أولى"),

            // محمود — no project
            Pay(customers[4], null, 1200, today.AddMonths(-3), "كاش", "أبو خالد"),
            Pay(customers[4], null, 1200, today.AddMonths(-2), "كاش", "أبو خالد"),

            // فاطمة — villa partial
            Pay(customers[5], p3, 15000, today.AddMonths(-5), "شيك", "خالد", "دفعة أولى"),
            Pay(customers[5], p3, 4000, today.AddMonths(-4), "كاش", "خالد"),
            Pay(customers[5], p3, 4000, today.AddMonths(-3), "كاش", "خالد"),
            Pay(customers[5], p3, 4000, today.AddMonths(-2), "تحويل بنكي", "خالد"),
            Pay(customers[5], p3, 4000, today.AddMonths(-1), "كاش", "خالد"),

            // ياسر — recent
            Pay(customers[6], p3, 12000, today.AddMonths(-4), "كاش", "خالد", "دفعة أولى"),
            Pay(customers[6], p3, 3500, today.AddMonths(-3), "كاش", "خالد"),
            Pay(customers[6], p3, 3500, today.AddMonths(-2), "كاش", "خالد"),

            // Today's payments for daily page testing
            Pay(customers[1], p1, 2500, today, "كاش", "محمد", "قسط الشهر الحالي"),
            Pay(customers[5], p3, 4000, today, "تحويل بنكي", "خالد"),
        };

        db.CustomerPayments.AddRange(payments);
        await db.SaveChangesAsync(ct);
    }

    private async Task SeedProjectExpensesAsync(List<Project> projects, DateOnly today, CancellationToken ct)
    {
        var expenses = new List<ProjectExpense>
        {
            Exp(projects[0].Id, "مقاول", "مؤسسة البناء الحديث", 28000, "أعمال الهيكل الإنشائي"),
            Exp(projects[0].Id, "حديد وأسمنت", "شركة الحديد الأردني", 15500, "توريد حديد تسليح"),
            Exp(projects[0].Id, "كهربجي", "كهرباء الأمين", 4200, "تمديدات أولية"),
            Exp(projects[1].Id, "بليط", "معرض الرخام", 9800, "بلاط أرضيات"),
            Exp(projects[1].Id, "موسرجي", "سباكة النور", 6500),
            Exp(projects[2].Id, "نجار", "نجارة الأصالة", 11200, "أبواب ونوافذ"),
            Exp(projects[2].Id, "باطون", "مختبر الباطون", 18500),
            Exp(projects[3].Id, "مواد", "مستودع المواد العام", 7300, "مشروع جديد"),
        };

        db.ProjectExpenses.AddRange(expenses);
        await db.SaveChangesAsync(ct);

        var expensePayments = new List<ProjectExpensePayment>
        {
            ExpPay(expenses[0], 15000, today.AddMonths(-3), "شيك", "محمد"),
            ExpPay(expenses[0], 8000, today.AddMonths(-2), "كاش", "محمد"),
            ExpPay(expenses[1], 15500, today.AddMonths(-3), "تحويل بنكي", "أبو خالد"),
            ExpPay(expenses[2], 2000, today.AddMonths(-1), "كاش", "محمد"),
            ExpPay(expenses[3], 5000, today.AddMonths(-2), "كاش", "خالد"),
            ExpPay(expenses[3], 4800, today.AddMonths(-1), "كاش", "خالد"),
            ExpPay(expenses[4], 6500, today.AddMonths(-1), "كاش", "خالد"),
            ExpPay(expenses[5], 6000, today.AddMonths(-2), "شيك", "خالد"),
            ExpPay(expenses[6], 10000, today.AddMonths(-1), "تحويل بنكي", "خالد"),
            ExpPay(expenses[7], 3000, today.AddDays(-5), "كاش", "عبدالله"),
            ExpPay(expenses[0], 5000, today, "كاش", "محمد", "دفعة اليوم"),
        };

        db.ProjectExpensePayments.AddRange(expensePayments);
        await db.SaveChangesAsync(ct);
    }

    private async Task SeedInventoryAsync(List<Project> projects, DateOnly today, CancellationToken ct)
    {
        var items = new List<InventoryItem>
        {
            Item("أسمنت", "كيس", "مواد", 120),
            Item("حديد 12مم", "طن", "حديد وأسمنت", 8.5m),
            Item("بلاط 60×60", "م²", "بليط", 450),
            Item("دهان داخلي", "علبة", "دهين", 35),
            Item("خشب باب", "قطعة", "نجار", 18),
            Item("أنابيب PVC", "متر", "موسرجي", 200),
        };

        db.InventoryItems.AddRange(items);
        await db.SaveChangesAsync(ct);

        var movements = new List<InventoryMovement>
        {
            Move(items[0], "in", 200, null, today.AddMonths(-4), "أبو خالد", "شراء أولي"),
            Move(items[0], "out", 80, projects[0].Id, today.AddMonths(-3), "محمد", "صرف لمشروع النخيل"),
            Move(items[1], "in", 12, null, today.AddMonths(-3), "أبو خالد"),
            Move(items[1], "out", 3.5m, projects[0].Id, today.AddMonths(-2), "محمد"),
            Move(items[2], "in", 500, null, today.AddMonths(-2), "خالد"),
            Move(items[2], "out", 50, projects[1].Id, today.AddMonths(-1), "خالد"),
            Move(items[3], "in", 40, null, today.AddMonths(-1), "محمد"),
            Move(items[3], "out", 5, projects[1].Id, today.AddDays(-10), "محمد"),
            Move(items[4], "in", 20, null, today.AddMonths(-1), "خالد"),
            Move(items[4], "out", 2, projects[2].Id, today.AddDays(-7), "خالد"),
            Move(items[5], "in", 250, null, today.AddDays(-15), "عبدالله"),
            Move(items[5], "out", 50, projects[3].Id, today, "عبدالله", "صرف اليوم"),
        };

        db.InventoryMovements.AddRange(movements);
        await db.SaveChangesAsync(ct);
    }

    private async Task SeedExternalExpensesAsync(DateOnly today, CancellationToken ct)
    {
        var expenses = new List<ExternalExpense>
        {
            Ext("إيجار مكتب", 800, today.AddMonths(-1), "كاش", "مالك المكتب", "محمد"),
            Ext("وقود ومواصلات", 350, today.AddDays(-20), "كاش", "محطة وقود", "أبو خالد"),
            Ext("قرطاسية ومطبوعات", 220, today.AddDays(-12), "فيزا", "مكتبة الأمل", "محمد"),
            Ext("اتصالات وإنترنت", 95, today.AddDays(-5), "تحويل بنكي", "زين", "محمد"),
            Ext("ضيافة وفحص موقع", 180, today, "كاش", "مطعم الساحة", "خالد", "زيارة موقع اليوم"),
        };

        db.ExternalExpenses.AddRange(expenses);
        await db.SaveChangesAsync(ct);
    }

    private async Task SeedDemoUsersAsync(CancellationToken ct)
    {
        var users = new (string User, string Pass, string Display)[]
        {
            ("manager", "Manager@123", "مدير العمليات"),
            ("accountant", "Accountant@123", "المحاسب"),
        };

        foreach (var (user, pass, display) in users)
        {
            var normalized = user.ToLowerInvariant();
            if (await db.Users.AnyAsync(u => u.UserName == normalized, ct)) continue;
            db.Users.Add(new AppUser
            {
                UserName = normalized,
                DisplayName = display,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(pass),
            });
        }
    }

    private static CustomerPayment Pay(Customer c, Guid? projectId, decimal amount, DateOnly date, string method, string recipient, string? notes = null) =>
        new()
        {
            CustomerId = c.Id,
            ProjectId = projectId ?? c.ProjectId,
            Amount = amount,
            PaymentDate = date,
            PaymentMethod = method,
            Recipient = recipient,
            EnteredBy = recipient,
            Notes = notes,
        };

    private static ProjectExpense Exp(Guid projectId, string category, string vendor, decimal total, string? notes = null) =>
        new() { ProjectId = projectId, Category = category, VendorName = vendor, TotalAmount = total, Notes = notes };

    private static ProjectExpensePayment ExpPay(ProjectExpense e, decimal amount, DateOnly date, string method, string by, string? notes = null) =>
        new() { ExpenseId = e.Id, Amount = amount, PaymentDate = date, PaymentMethod = method, EnteredBy = by, Notes = notes };

    private static InventoryItem Item(string name, string unit, string category, decimal qty) =>
        new() { Name = name, Unit = unit, Category = category, Quantity = qty };

    private static InventoryMovement Move(InventoryItem item, string type, decimal qty, Guid? projectId, DateOnly date, string by, string? notes = null) =>
        new() { ItemId = item.Id, MovementType = type, Quantity = qty, ProjectId = projectId, MovementDate = date, EnteredBy = by, Notes = notes };

    private static ExternalExpense Ext(string type, decimal amount, DateOnly date, string method, string beneficiary, string by, string? notes = null) =>
        new() { ExpenseType = type, Amount = amount, ExpenseDate = date, PaymentMethod = method, Beneficiary = beneficiary, EnteredBy = by, Notes = notes };
}

public record SeedResult(bool Ok, string Message, Dictionary<string, int>? Counts = null)
{
    public static SeedResult Success(Dictionary<string, int> counts) =>
        new(true, "تمت إضافة البيانات التجريبية بنجاح.", counts);

    public static SeedResult Skipped(string message) => new(false, message);
}
