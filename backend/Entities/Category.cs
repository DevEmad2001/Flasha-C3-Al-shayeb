namespace AlShaibHousing.Api.Entities;

public class Category
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public required string Type { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
