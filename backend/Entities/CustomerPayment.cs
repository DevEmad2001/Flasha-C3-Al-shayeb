namespace AlShaibHousing.Api.Entities;

public class CustomerPayment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public Guid? ProjectId { get; set; }
    public decimal Amount { get; set; }
    public DateOnly PaymentDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public string PaymentMethod { get; set; } = "كاش";
    public string? Recipient { get; set; }
    public string? EnteredBy { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Customer Customer { get; set; } = null!;
    public Project? Project { get; set; }
}
