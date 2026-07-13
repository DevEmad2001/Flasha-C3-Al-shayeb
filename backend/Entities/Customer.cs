namespace AlShaibHousing.Api.Entities;

public class Customer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public string? Phone { get; set; }
    public Guid? ProjectId { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal DownPayment { get; set; }
    public decimal MonthlyInstallment { get; set; }
    public DateOnly? StartDate { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Project? Project { get; set; }
    public ICollection<CustomerPayment> Payments { get; set; } = [];
}
