namespace AlShaibHousing.Api.Configuration;

public class SeedOptions
{
    public const string SectionName = "Seed";

    public string AdminUser { get; set; } = "admin";
    public string AdminPassword { get; set; } = "Admin@123";
    public SampleDataOptions SampleData { get; set; } = new();
}

public class SampleDataOptions
{
    /// <summary>Seed example business data on startup.</summary>
    public bool Enabled { get; set; }

    /// <summary>Skip sample seed when any project already exists.</summary>
    public bool OnlyIfEmpty { get; set; } = true;

    /// <summary>Create manager + accountant demo users.</summary>
    public bool IncludeDemoUsers { get; set; } = true;

    /// <summary>Allow reset/reseed via admin API (recommended: Development only).</summary>
    public bool AllowAdminReset { get; set; } = true;

    /// <summary>Allow clearing business data without re-seeding via admin API.</summary>
    public bool AllowAdminClear { get; set; } = true;
}
