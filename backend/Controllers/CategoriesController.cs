using AlShaibHousing.Api.Data;
using AlShaibHousing.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AlShaibHousing.Api.Controllers;

[ApiController]
[Route("api/categories")]
[Authorize]
public class CategoriesController(AppDbContext db) : ControllerBase
{
    public record CategoryDto(string Name, string Type);

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] string? type)
    {
        var query = db.Categories.AsQueryable();
        if (!string.IsNullOrEmpty(type)) query = query.Where(c => c.Type == type);
        return Ok(await query.OrderBy(c => c.Name).Select(c => new { c.Id, c.Name, c.Type }).ToListAsync());
    }

    [HttpGet("{id:guid}/usage-count")]
    public async Task<ActionResult> UsageCount(Guid id, [FromQuery] string? name)
    {
        var cat = await db.Categories.FindAsync(id);
        var itemName = name ?? cat?.Name;
        if (itemName is null || cat is null) return NotFound();

        var count = cat.Type switch
        {
            CategoryTypes.PaymentMethod => await CountPaymentMethodUsageAsync(itemName),
            CategoryTypes.Recipient => await db.CustomerPayments.CountAsync(p => p.Recipient == itemName),
            _ => await db.ProjectExpenses.CountAsync(e => e.Category == itemName),
        };

        return Ok(new { count });
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CategoryDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "الاسم مطلوب" });

        var type = NormalizeType(dto.Type);
        var name = dto.Name.Trim();

        if (await db.Categories.AnyAsync(c => c.Name == name && c.Type == type))
            return Conflict(new { message = "الاسم موجود مسبقاً" });

        var cat = new Category { Name = name, Type = type };
        db.Categories.Add(cat);
        await db.SaveChangesAsync();
        return Ok(cat);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult> Update(Guid id, [FromBody] CategoryDto dto)
    {
        var cat = await db.Categories.FindAsync(id);
        if (cat is null) return NotFound();

        var oldName = cat.Name;
        var newName = dto.Name.Trim();
        cat.Name = newName;

        if (oldName != newName)
        {
            if (cat.Type == CategoryTypes.PaymentMethod)
                await RenamePaymentMethodAsync(oldName, newName);
            else if (cat.Type == CategoryTypes.Recipient)
                await db.CustomerPayments.Where(p => p.Recipient == oldName)
                    .ExecuteUpdateAsync(s => s.SetProperty(p => p.Recipient, newName));
            else
                await db.ProjectExpenses
                    .Where(e => e.Category == oldName)
                    .ExecuteUpdateAsync(s => s.SetProperty(e => e.Category, newName));
        }

        await db.SaveChangesAsync();
        return Ok(cat);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id)
    {
        var cat = await db.Categories.FindAsync(id);
        if (cat is null) return NotFound();

        var count = cat.Type switch
        {
            CategoryTypes.PaymentMethod => await CountPaymentMethodUsageAsync(cat.Name),
            CategoryTypes.Recipient => await db.CustomerPayments.CountAsync(p => p.Recipient == cat.Name),
            _ => await db.ProjectExpenses.CountAsync(e => e.Category == cat.Name),
        };

        if (count > 0)
            return BadRequest(new { message = $"لا يمكن الحذف، مستخدم في {count} سجل", count });

        db.Categories.Remove(cat);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static string NormalizeType(string type) =>
        type is CategoryTypes.PaymentMethod or CategoryTypes.Expense or CategoryTypes.Recipient
            ? type
            : CategoryTypes.Expense;

    private async Task<int> CountPaymentMethodUsageAsync(string name) =>
        await db.CustomerPayments.CountAsync(p => p.PaymentMethod == name)
        + await db.ProjectExpensePayments.CountAsync(p => p.PaymentMethod == name)
        + await db.ExternalExpenses.CountAsync(e => e.PaymentMethod == name);

    private async Task RenamePaymentMethodAsync(string oldName, string newName)
    {
        await db.CustomerPayments.Where(p => p.PaymentMethod == oldName)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.PaymentMethod, newName));
        await db.ProjectExpensePayments.Where(p => p.PaymentMethod == oldName)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.PaymentMethod, newName));
        await db.ExternalExpenses.Where(e => e.PaymentMethod == oldName)
            .ExecuteUpdateAsync(s => s.SetProperty(e => e.PaymentMethod, newName));
    }
}
