namespace AlShaibHousing.Api.Entities;

public class ProjectExpensePayment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ExpenseId { get; set; }
    public decimal Amount { get; set; }
    public DateOnly PaymentDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public string PaymentMethod { get; set; } = "كاش";
    public string? EnteredBy { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ProjectExpense Expense { get; set; } = null!;
}
