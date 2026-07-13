using AlShaibHousing.Api.Data;
using AlShaibHousing.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AlShaibHousing.Api.Controllers;

[ApiController]
[Route("api/external-expenses")]
[Authorize]
public class ExternalExpensesController(AppDbContext db) : ControllerBase
{
    public record ExternalDto(
        string? ExpenseType, decimal? Amount, string? PaymentMethod,
        string? Beneficiary, DateOnly? ExpenseDate, string? EnteredBy, string? Notes);

    [HttpGet]
    public async Task<ActionResult> List(
        [FromQuery] DateOnly? date,
        [FromQuery] DateOnly? start,
        [FromQuery] DateOnly? end)
    {
        var query = db.ExternalExpenses.AsQueryable();
        if (date.HasValue) query = query.Where(e => e.ExpenseDate == date.Value);
        if (start.HasValue) query = query.Where(e => e.ExpenseDate >= start.Value);
        if (end.HasValue) query = query.Where(e => e.ExpenseDate <= end.Value);

        return Ok(await query.OrderByDescending(e => e.ExpenseDate).ToListAsync());
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] ExternalDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ExpenseType) || !dto.Amount.HasValue)
            return BadRequest(new { message = "بيانات غير مكتملة" });

        var expense = new ExternalExpense
        {
            ExpenseType = dto.ExpenseType,
            Amount = dto.Amount.Value,
            PaymentMethod = dto.PaymentMethod ?? "كاش",
            Beneficiary = dto.Beneficiary,
            ExpenseDate = dto.ExpenseDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
            EnteredBy = dto.EnteredBy,
            Notes = dto.Notes,
        };
        db.ExternalExpenses.Add(expense);
        await db.SaveChangesAsync();
        return Ok(expense);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult> Update(Guid id, [FromBody] ExternalDto dto)
    {
        var expense = await db.ExternalExpenses.FindAsync(id);
        if (expense is null) return NotFound();
        if (dto.ExpenseType is not null) expense.ExpenseType = dto.ExpenseType;
        if (dto.Amount.HasValue) expense.Amount = dto.Amount.Value;
        if (dto.PaymentMethod is not null) expense.PaymentMethod = dto.PaymentMethod;
        expense.Beneficiary = dto.Beneficiary;
        if (dto.ExpenseDate.HasValue) expense.ExpenseDate = dto.ExpenseDate.Value;
        expense.EnteredBy = dto.EnteredBy;
        expense.Notes = dto.Notes;
        await db.SaveChangesAsync();
        return Ok(expense);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id)
    {
        var expense = await db.ExternalExpenses.FindAsync(id);
        if (expense is null) return NotFound();
        db.ExternalExpenses.Remove(expense);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
