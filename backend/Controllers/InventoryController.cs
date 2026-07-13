using AlShaibHousing.Api.Data;
using AlShaibHousing.Api.Entities;
using AlShaibHousing.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AlShaibHousing.Api.Controllers;

[ApiController]
[Route("api/inventory-items")]
[Authorize]
public class InventoryItemsController(AppDbContext db) : ControllerBase
{
    public record ItemDto(string? Name, string? Unit, string? Category, decimal? Quantity, string? Notes);

    [HttpGet]
    public async Task<ActionResult> List()
    {
        return Ok(await db.InventoryItems.OrderBy(i => i.Name).ToListAsync());
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] ItemDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "الاسم مطلوب" });

        var item = new InventoryItem
        {
            Name = dto.Name.Trim(),
            Unit = dto.Unit,
            Category = dto.Category,
            Quantity = dto.Quantity ?? 0,
            Notes = dto.Notes,
        };
        db.InventoryItems.Add(item);
        await db.SaveChangesAsync();
        return Ok(item);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult> Update(Guid id, [FromBody] ItemDto dto)
    {
        var item = await db.InventoryItems.FindAsync(id);
        if (item is null) return NotFound();
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "الاسم مطلوب" });

        item.Name = dto.Name.Trim();
        item.Unit = dto.Unit;
        item.Category = dto.Category;
        item.Notes = dto.Notes;
        await db.SaveChangesAsync();
        return Ok(item);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id)
    {
        var item = await db.InventoryItems.FindAsync(id);
        if (item is null) return NotFound();
        db.InventoryItems.Remove(item);
        await db.SaveChangesAsync();
        return NoContent();
    }
}

[ApiController]
[Route("api/inventory-movements")]
[Authorize]
public class InventoryMovementsController(AppDbContext db, InventoryService inventory) : ControllerBase
{
    public record MovementDto(
        Guid? ItemId, string? MovementType, decimal? Quantity,
        Guid? ProjectId, DateOnly? MovementDate, string? EnteredBy, string? Notes);

    [HttpGet]
    public async Task<ActionResult> List(
        [FromQuery] DateOnly? start,
        [FromQuery] DateOnly? end,
        [FromQuery] Guid? project_id,
        [FromQuery] Guid? item_id)
    {
        var query = db.InventoryMovements
            .Include(m => m.Item)
            .Include(m => m.Project)
            .AsQueryable();

        if (start.HasValue) query = query.Where(m => m.MovementDate >= start.Value);
        if (end.HasValue) query = query.Where(m => m.MovementDate <= end.Value);
        if (project_id.HasValue) query = query.Where(m => m.ProjectId == project_id.Value);
        if (item_id.HasValue) query = query.Where(m => m.ItemId == item_id.Value);

        var rows = await query.OrderByDescending(m => m.MovementDate).ToListAsync();
        return Ok(rows.Select(m => new
        {
            m.Id,
            item_id = m.ItemId,
            movement_type = m.MovementType,
            m.Quantity,
            project_id = m.ProjectId,
            movement_date = m.MovementDate,
            entered_by = m.EnteredBy,
            m.Notes,
            item = m.Item is null ? null : new { m.Item.Id, m.Item.Name, m.Item.Unit, m.Item.Category },
            project = m.Project is null ? null : new { m.Project.Id, m.Project.Name },
        }));
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] MovementDto dto)
    {
        if (!dto.ItemId.HasValue || string.IsNullOrWhiteSpace(dto.MovementType) || !dto.Quantity.HasValue)
            return BadRequest(new { message = "بيانات الحركة غير مكتملة" });

        var movement = new InventoryMovement
        {
            ItemId = dto.ItemId.Value,
            MovementType = dto.MovementType,
            Quantity = dto.Quantity.Value,
            ProjectId = dto.ProjectId,
            MovementDate = dto.MovementDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
            EnteredBy = dto.EnteredBy,
            Notes = dto.Notes,
        };
        db.InventoryMovements.Add(movement);
        try
        {
            inventory.ApplyMovement(movement);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        await db.SaveChangesAsync();
        return Ok(new { id = movement.Id });
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult> Update(Guid id, [FromBody] MovementDto dto)
    {
        var tracked = await db.InventoryMovements.FindAsync(id);
        if (tracked is null) return NotFound();

        var snapshot = new InventoryMovement
        {
            ItemId = tracked.ItemId,
            MovementType = tracked.MovementType,
            Quantity = tracked.Quantity,
        };

        var updated = new InventoryMovement
        {
            ItemId = dto.ItemId ?? tracked.ItemId,
            MovementType = dto.MovementType ?? tracked.MovementType,
            Quantity = dto.Quantity ?? tracked.Quantity,
        };

        try
        {
            inventory.UpdateMovement(snapshot, updated);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        tracked.ItemId = updated.ItemId;
        tracked.MovementType = updated.MovementType;
        tracked.Quantity = updated.Quantity;
        tracked.ProjectId = dto.ProjectId ?? tracked.ProjectId;
        tracked.MovementDate = dto.MovementDate ?? tracked.MovementDate;
        tracked.EnteredBy = dto.EnteredBy ?? tracked.EnteredBy;
        tracked.Notes = dto.Notes ?? tracked.Notes;
        await db.SaveChangesAsync();
        return Ok(tracked);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id)
    {
        var movement = await db.InventoryMovements.FindAsync(id);
        if (movement is null) return NotFound();
        inventory.ReverseMovement(movement);
        db.InventoryMovements.Remove(movement);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
