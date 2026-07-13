using AlShaibHousing.Api.Configuration;
using AlShaibHousing.Api.Data;
using AlShaibHousing.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace AlShaibHousing.Api.Services;

public static class DbSeeder
{
    private static readonly string[] ExpenseCategories =
    [
        "مقاول", "مواد", "حجر", "تنك مي", "موسرجي", "بليط", "دهين",
        "متفرقات", "نجار", "كهربجي", "جبسن بورد", "حديد وأسمنت", "باطون",
    ];

    private static readonly string[] PaymentMethods =
    [
        "كاش", "تحويل بنكي", "شيك", "فيزا", "أخرى",
    ];

    public static async Task SeedAsync(AppDbContext db, IConfiguration config, SampleDataSeeder sampleSeeder)
    {
        var options = config.GetSection(SeedOptions.SectionName).Get<SeedOptions>() ?? new SeedOptions();

        await db.Database.EnsureCreatedAsync();
        await SeedCoreAsync(db, options);

        if (options.SampleData.Enabled)
            await sampleSeeder.SeedAsync(force: false);
    }

    public static async Task SeedCoreAsync(AppDbContext db, SeedOptions options)
    {
        if (!await db.Users.AnyAsync(u => u.UserName == options.AdminUser.ToLowerInvariant()))
        {
            db.Users.Add(new AppUser
            {
                UserName = options.AdminUser.ToLowerInvariant(),
                DisplayName = "مدير النظام",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(options.AdminPassword),
            });
        }

        await EnsureCategoriesAsync(db, ExpenseCategories, CategoryTypes.Expense);
        await EnsureCategoriesAsync(db, PaymentMethods, CategoryTypes.PaymentMethod);

        await db.SaveChangesAsync();
    }

    private static async Task EnsureCategoriesAsync(AppDbContext db, IEnumerable<string> names, string type)
    {
        foreach (var name in names)
        {
            if (!await db.Categories.AnyAsync(c => c.Name == name && c.Type == type))
                db.Categories.Add(new Category { Name = name, Type = type });
        }
    }
}
