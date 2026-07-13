namespace AlShaibHousing.Api.Entities;

public class InventoryMovement
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ItemId { get; set; }
    public required string MovementType { get; set; }
    public decimal Quantity { get; set; }
    public Guid? ProjectId { get; set; }
    public DateOnly MovementDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public string? EnteredBy { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public InventoryItem Item { get; set; } = null!;
    public Project? Project { get; set; }
}
