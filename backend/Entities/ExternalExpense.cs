namespace AlShaibHousing.Api.Entities;

public class ExternalExpense
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string ExpenseType { get; set; }
    public decimal Amount { get; set; }
    public string PaymentMethod { get; set; } = "كاش";
    public string? Beneficiary { get; set; }
    public DateOnly ExpenseDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public string? EnteredBy { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
