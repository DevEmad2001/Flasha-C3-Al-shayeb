using AlShaibHousing.Api.Data;
using AlShaibHousing.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AlShaibHousing.Api.Controllers;

[ApiController]
[Route("api/customers")]
[Authorize]
public class CustomersController(AppDbContext db) : ControllerBase
{
    public record CustomerDto(
        string? Name, string? Phone, Guid? ProjectId,
        decimal? TotalAmount, decimal? DownPayment, decimal? MonthlyInstallment,
        DateOnly? StartDate, string? Notes);

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] bool full = false, [FromQuery] string? fields = null)
    {
        if (fields == "stocktake")
        {
            return Ok(await db.Customers
                .OrderBy(c => c.Name)
                .Select(c => new
                {
                    c.Id, c.Name, c.Phone, c.ProjectId, c.TotalAmount,
                    down_payment = c.DownPayment,
                    monthly_installment = c.MonthlyInstallment,
                })
                .ToListAsync());
        }

        if (!full)
        {
            return Ok(await db.Customers.OrderByDescending(c => c.CreatedAt).ToListAsync());
        }

        var customers = await db.Customers
            .Include(c => c.Project)
            .Include(c => c.Payments)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        return Ok(customers.Select(MapFull));
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CustomerDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "اسم الزبون مطلوب" });

        var customer = new Customer
        {
            Name = dto.Name.Trim(),
            Phone = dto.Phone,
            ProjectId = dto.ProjectId,
            TotalAmount = dto.TotalAmount ?? 0,
            DownPayment = dto.DownPayment ?? 0,
            MonthlyInstallment = dto.MonthlyInstallment ?? 0,
            StartDate = dto.StartDate,
            Notes = dto.Notes,
        };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();
        return Ok(new { id = customer.Id, customer });
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult> Update(Guid id, [FromBody] CustomerDto dto)
    {
        var customer = await db.Customers.FindAsync(id);
        if (customer is null) return NotFound();
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "اسم الزبون مطلوب" });

        customer.Name = dto.Name.Trim();
        customer.Phone = dto.Phone;
        customer.ProjectId = dto.ProjectId;
        customer.TotalAmount = dto.TotalAmount ?? customer.TotalAmount;
        customer.DownPayment = dto.DownPayment ?? customer.DownPayment;
        customer.MonthlyInstallment = dto.MonthlyInstallment ?? customer.MonthlyInstallment;
        customer.StartDate = dto.StartDate ?? customer.StartDate;
        customer.Notes = dto.Notes;
        await db.SaveChangesAsync();
        return Ok(customer);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id)
    {
        var customer = await db.Customers.FindAsync(id);
        if (customer is null) return NotFound();
        db.Customers.Remove(customer);
        await db.SaveChangesAsync();
        return NoContent();
    }

    internal static object MapFull(Customer c) => new
    {
        c.Id,
        c.Name,
        c.Phone,
        project_id = c.ProjectId,
        total_amount = c.TotalAmount,
        down_payment = c.DownPayment,
        monthly_installment = c.MonthlyInstallment,
        start_date = c.StartDate,
        c.Notes,
        c.CreatedAt,
        c.UpdatedAt,
        project = c.Project is null ? null : new { c.Project.Name, owner_name = c.Project.OwnerName },
        payments = c.Payments.OrderByDescending(p => p.PaymentDate).Select(p => new
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
        }),
    };
}
