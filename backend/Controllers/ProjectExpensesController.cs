using AlShaibHousing.Api.Data;
using AlShaibHousing.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AlShaibHousing.Api.Controllers;

[ApiController]
[Route("api/project-expenses")]
[Authorize]
public class ProjectExpensesController(AppDbContext db) : ControllerBase
{
    public record ExpenseDto(Guid? ProjectId, string? Category, string? VendorName, decimal? TotalAmount, string? Notes);

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] Guid project_id)
    {
        var expenses = await db.ProjectExpenses
            .Include(e => e.Payments)
            .Where(e => e.ProjectId == project_id)
            .OrderBy(e => e.Category)
            .ToListAsync();

        return Ok(expenses.Select(e => new
        {
            e.Id,
            e.Category,
            vendor_name = e.VendorName,
            total_amount = e.TotalAmount,
            e.Notes,
            project_id = e.ProjectId,
            e.CreatedAt,
            e.UpdatedAt,
            payments = e.Payments.OrderByDescending(p => p.PaymentDate).Select(p => new
            {
                p.Id,
                p.Amount,
                payment_date = p.PaymentDate,
                payment_method = p.PaymentMethod,
                entered_by = p.EnteredBy,
                p.Notes,
                expense_id = p.ExpenseId,
            }),
        }));
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] ExpenseDto dto)
    {
        if (!dto.ProjectId.HasValue || string.IsNullOrWhiteSpace(dto.Category))
            return BadRequest(new { message = "بيانات غير مكتملة" });

        var expense = new ProjectExpense
        {
            ProjectId = dto.ProjectId.Value,
            Category = dto.Category,
            VendorName = dto.VendorName,
            TotalAmount = dto.TotalAmount ?? 0,
            Notes = dto.Notes,
        };
        db.ProjectExpenses.Add(expense);
        await db.SaveChangesAsync();
        return Ok(new { id = expense.Id });
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult> Update(Guid id, [FromBody] ExpenseDto dto)
    {
        var expense = await db.ProjectExpenses.FindAsync(id);
        if (expense is null) return NotFound();
        if (dto.Category is not null) expense.Category = dto.Category;
        expense.VendorName = dto.VendorName;
        if (dto.TotalAmount.HasValue) expense.TotalAmount = dto.TotalAmount.Value;
        expense.Notes = dto.Notes;
        await db.SaveChangesAsync();
        return Ok(expense);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id)
    {
        var expense = await db.ProjectExpenses.FindAsync(id);
        if (expense is null) return NotFound();
        db.ProjectExpenses.Remove(expense);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
