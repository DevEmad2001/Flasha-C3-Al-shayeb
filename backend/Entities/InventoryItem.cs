namespace AlShaibHousing.Api.Entities;

public class InventoryItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public string? Unit { get; set; }
    public string? Category { get; set; }
    public decimal Quantity { get; set; }
    /// <summary>Informational unit price only. Not used in any quantity, stocktake or financial calculation.</summary>
    public decimal? Price { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<InventoryMovement> Movements { get; set; } = [];
}
