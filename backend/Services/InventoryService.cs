using AlShaibHousing.Api.Data;
using AlShaibHousing.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace AlShaibHousing.Api.Services;

public class InventoryService(AppDbContext db)
{
    public void ApplyMovement(InventoryMovement movement)
    {
        var item = db.InventoryItems.Local.FirstOrDefault(i => i.Id == movement.ItemId)
            ?? db.InventoryItems.First(i => i.Id == movement.ItemId);

        if (movement.MovementType == "in" && item.Quantity < movement.Quantity)
            throw new InvalidOperationException($"الكمية في المستودع غير كافية. المتوفر: {item.Quantity}");

        AdjustQuantity(item, movement.MovementType, movement.Quantity);
        item.UpdatedAt = DateTime.UtcNow;
    }

    public void ReverseMovement(InventoryMovement movement)
    {
        var item = db.InventoryItems.First(i => i.Id == movement.ItemId);
        var reverseType = movement.MovementType == "in" ? "out" : "in";
        AdjustQuantity(item, reverseType, movement.Quantity);
        item.UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateMovement(InventoryMovement oldMovement, InventoryMovement newMovement)
    {
        var reverseType = oldMovement.MovementType == "in" ? "out" : "in";
        var oldItem = db.InventoryItems.First(i => i.Id == oldMovement.ItemId);
        AdjustQuantity(oldItem, reverseType, oldMovement.Quantity);
        oldItem.UpdatedAt = DateTime.UtcNow;

        var newItem = oldMovement.ItemId == newMovement.ItemId
            ? oldItem
            : db.InventoryItems.First(i => i.Id == newMovement.ItemId);

        if (newMovement.MovementType == "in" && newItem.Quantity < newMovement.Quantity)
            throw new InvalidOperationException($"الكمية في المستودع غير كافية. المتوفر: {newItem.Quantity}");

        AdjustQuantity(newItem, newMovement.MovementType, newMovement.Quantity);
        newItem.UpdatedAt = DateTime.UtcNow;
    }

    private static void AdjustQuantity(InventoryItem item, string movementType, decimal quantity)
    {
        item.Quantity += movementType == "in" ? -quantity : quantity;
    }
}
