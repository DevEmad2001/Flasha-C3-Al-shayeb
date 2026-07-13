using AlShaibHousing.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace AlShaibHousing.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<CustomerPayment> CustomerPayments => Set<CustomerPayment>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<ProjectExpense> ProjectExpenses => Set<ProjectExpense>();
    public DbSet<ProjectExpensePayment> ProjectExpensePayments => Set<ProjectExpensePayment>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<InventoryMovement> InventoryMovements => Set<InventoryMovement>();
    public DbSet<ExternalExpense> ExternalExpenses => Set<ExternalExpense>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>(e =>
        {
            e.HasIndex(x => x.UserName).IsUnique();
            e.Property(x => x.UserName).HasMaxLength(64);
        });

        modelBuilder.Entity<Project>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(256);
        });

        modelBuilder.Entity<Customer>(e =>
        {
            e.Property(x => x.TotalAmount).HasPrecision(14, 2);
            e.Property(x => x.DownPayment).HasPrecision(14, 2);
            e.Property(x => x.MonthlyInstallment).HasPrecision(14, 2);
            e.HasOne(x => x.Project).WithMany(x => x.Customers).HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<CustomerPayment>(e =>
        {
            e.Property(x => x.Amount).HasPrecision(14, 2);
            e.HasOne(x => x.Customer).WithMany(x => x.Payments).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Project).WithMany(x => x.CustomerPayments).HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Category>(e =>
        {
            e.HasIndex(x => new { x.Name, x.Type }).IsUnique();
            e.Property(x => x.Name).HasMaxLength(128);
            e.Property(x => x.Type).HasMaxLength(32);
        });

        modelBuilder.Entity<ProjectExpense>(e =>
        {
            e.Property(x => x.TotalAmount).HasPrecision(14, 2);
            e.Property(x => x.Category).HasMaxLength(128);
            e.HasOne(x => x.Project).WithMany(x => x.ProjectExpenses).HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ProjectExpensePayment>(e =>
        {
            e.Property(x => x.Amount).HasPrecision(14, 2);
            e.HasOne(x => x.Expense).WithMany(x => x.Payments).HasForeignKey(x => x.ExpenseId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<InventoryItem>(e =>
        {
            e.Property(x => x.Quantity).HasPrecision(14, 2);
        });

        modelBuilder.Entity<InventoryMovement>(e =>
        {
            e.Property(x => x.Quantity).HasPrecision(14, 2);
            e.Property(x => x.MovementType).HasMaxLength(8);
            e.HasOne(x => x.Item).WithMany(x => x.Movements).HasForeignKey(x => x.ItemId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Project).WithMany(x => x.InventoryMovements).HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ExternalExpense>(e =>
        {
            e.Property(x => x.Amount).HasPrecision(14, 2);
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.Entity is Project p && entry.State == EntityState.Modified)
                p.UpdatedAt = now;
            if (entry.Entity is Customer c && entry.State == EntityState.Modified)
                c.UpdatedAt = now;
            if (entry.Entity is ProjectExpense pe && entry.State == EntityState.Modified)
                pe.UpdatedAt = now;
            if (entry.Entity is InventoryItem ii && entry.State == EntityState.Modified)
                ii.UpdatedAt = now;
        }
        return base.SaveChangesAsync(cancellationToken);
    }
}
