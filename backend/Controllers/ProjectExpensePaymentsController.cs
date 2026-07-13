using AlShaibHousing.Api.Data;
using AlShaibHousing.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AlShaibHousing.Api.Controllers;

[ApiController]
[Route("api/project-expense-payments")]
[Authorize]
public class ProjectExpensePaymentsController(AppDbContext db) : ControllerBase
{
    public record PayDto(
        Guid? ExpenseId, decimal? Amount, DateOnly? PaymentDate,
        string? PaymentMethod, string? EnteredBy, string? Notes);

    [HttpGet]
    public async Task<ActionResult> List(
        [FromQuery] DateOnly? date,
        [FromQuery] DateOnly? start,
        [FromQuery] DateOnly? end,
        [FromQuery] Guid? project_id,
        [FromQuery] string? category)
    {
        var query = db.ProjectExpensePayments
            .Include(p => p.Expense).ThenInclude(e => e.Project)
            .AsQueryable();

        if (date.HasValue) query = query.Where(p => p.PaymentDate == date.Value);
        if (start.HasValue) query = query.Where(p => p.PaymentDate >= start.Value);
        if (end.HasValue) query = query.Where(p => p.PaymentDate <= end.Value);
        if (project_id.HasValue) query = query.Where(p => p.Expense.ProjectId == project_id.Value);
        if (!string.IsNullOrEmpty(category)) query = query.Where(p => p.Expense.Category == category);

        var rows = await query.OrderByDescending(p => p.PaymentDate).ToListAsync();
        return Ok(rows.Select(Map));
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] PayDto dto)
    {
        if (!dto.ExpenseId.HasValue || !dto.Amount.HasValue)
            return BadRequest(new { message = "بيانات غير مكتملة" });

        var payment = new ProjectExpensePayment
        {
            ExpenseId = dto.ExpenseId.Value,
            Amount = dto.Amount.Value,
            PaymentDate = dto.PaymentDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
            PaymentMethod = dto.PaymentMethod ?? "كاش",
            EnteredBy = dto.EnteredBy,
            Notes = dto.Notes,
        };
        db.ProjectExpensePayments.Add(payment);
        await db.SaveChangesAsync();
        return Ok(new { id = payment.Id });
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult> Update(Guid id, [FromBody] PayDto dto)
    {
        var payment = await db.ProjectExpensePayments.FindAsync(id);
        if (payment is null) return NotFound();
        if (dto.Amount.HasValue) payment.Amount = dto.Amount.Value;
        if (dto.PaymentDate.HasValue) payment.PaymentDate = dto.PaymentDate.Value;
        if (dto.PaymentMethod is not null) payment.PaymentMethod = dto.PaymentMethod;
        payment.EnteredBy = dto.EnteredBy;
        payment.Notes = dto.Notes;
        await db.SaveChangesAsync();
        return Ok(payment);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id)
    {
        var payment = await db.ProjectExpensePayments.FindAsync(id);
        if (payment is null) return NotFound();
        db.ProjectExpensePayments.Remove(payment);
        await db.SaveChangesAsync();
        return NoContent();
    }

    internal static object Map(ProjectExpensePayment p) => new
    {
        p.Id,
        p.Amount,
        payment_date = p.PaymentDate,
        payment_method = p.PaymentMethod,
        entered_by = p.EnteredBy,
        p.Notes,
        expense = new
        {
            p.Expense.Category,
            vendor_name = p.Expense.VendorName,
            project_id = p.Expense.ProjectId,
            project = p.Expense.Project is null ? null : new { p.Expense.Project.Id, p.Expense.Project.Name, owner_name = p.Expense.Project.OwnerName },
        },
    };
}
