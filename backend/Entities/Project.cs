namespace AlShaibHousing.Api.Entities;

public class Project
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public string? Location { get; set; }
    public string? OwnerName { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Customer> Customers { get; set; } = [];
    public ICollection<CustomerPayment> CustomerPayments { get; set; } = [];
    public ICollection<ProjectExpense> ProjectExpenses { get; set; } = [];
    public ICollection<InventoryMovement> InventoryMovements { get; set; } = [];
}
