using AlShaibHousing.Api.Data;
using AlShaibHousing.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AlShaibHousing.Api.Controllers;

[ApiController]
[Route("api/customer-payments")]
[Authorize]
public class CustomerPaymentsController(AppDbContext db) : ControllerBase
{
    public record PaymentDto(
        Guid? CustomerId, Guid? ProjectId, decimal? Amount,
        DateOnly? PaymentDate, string? PaymentMethod,
        string? Recipient, string? EnteredBy, string? Notes);

    [HttpGet]
    public async Task<ActionResult> List(
        [FromQuery] DateOnly? date,
        [FromQuery] DateOnly? start,
        [FromQuery] DateOnly? end,
        [FromQuery] Guid? project_id,
        [FromQuery] Guid? customer_id,
        [FromQuery] int? limit,
        [FromQuery] bool include_relations = true)
    {
        var query = db.CustomerPayments.AsQueryable();

        if (date.HasValue) query = query.Where(p => p.PaymentDate == date.Value);
        if (start.HasValue) query = query.Where(p => p.PaymentDate >= start.Value);
        if (end.HasValue) query = query.Where(p => p.PaymentDate <= end.Value);
        if (project_id.HasValue) query = query.Where(p => p.ProjectId == project_id.Value);
        if (customer_id.HasValue) query = query.Where(p => p.CustomerId == customer_id.Value);

        query = query.OrderByDescending(p => p.PaymentDate);
        if (limit.HasValue) query = query.Take(limit.Value);

        if (!include_relations)
        {
            return Ok(await query.Select(p => new { p.Amount }).ToListAsync());
        }

        var rows = await query
            .Include(p => p.Customer)
            .Include(p => p.Project)
            .ToListAsync();

        return Ok(rows.Select(Map));
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] PaymentDto dto)
    {
        if (!dto.CustomerId.HasValue || !dto.Amount.HasValue || dto.Amount <= 0)
            return BadRequest(new { message = "بيانات الدفعة غير مكتملة" });

        var payment = new CustomerPayment
        {
            CustomerId = dto.CustomerId.Value,
            ProjectId = dto.ProjectId,
            Amount = dto.Amount.Value,
            PaymentDate = dto.PaymentDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
            PaymentMethod = dto.PaymentMethod ?? "كاش",
            Recipient = dto.Recipient,
            EnteredBy = dto.EnteredBy,
            Notes = dto.Notes,
        };
        db.CustomerPayments.Add(payment);
        await db.SaveChangesAsync();
        return Ok(new { id = payment.Id });
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult> Update(Guid id, [FromBody] PaymentDto dto)
    {
        var payment = await db.CustomerPayments.FindAsync(id);
        if (payment is null) return NotFound();

        if (dto.Amount.HasValue) payment.Amount = dto.Amount.Value;
        if (dto.PaymentDate.HasValue) payment.PaymentDate = dto.PaymentDate.Value;
        if (dto.PaymentMethod is not null) payment.PaymentMethod = dto.PaymentMethod;
        payment.Recipient = dto.Recipient;
        payment.EnteredBy = dto.EnteredBy;
        payment.Notes = dto.Notes;
        await db.SaveChangesAsync();
        return Ok(payment);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id)
    {
        var payment = await db.CustomerPayments.FindAsync(id);
        if (payment is null) return NotFound();
        db.CustomerPayments.Remove(payment);
        await db.SaveChangesAsync();
        return NoContent();
    }

    internal static object Map(CustomerPayment p) => new
    {
        p.Id,
        p.Amount,
        payment_date = p.PaymentDate,
        payment_method = p.PaymentMethod,
        p.Recipient,
        entered_by = p.EnteredBy,
        p.Notes,
        customer_id = p.CustomerId,
        project_id = p.ProjectId,
        customer = p.Customer is null ? null : new { p.Customer.Name, total_amount = p.Customer.TotalAmount },
        project = p.Project is null ? null : new { p.Project.Name, owner_name = p.Project.OwnerName },
    };
}
