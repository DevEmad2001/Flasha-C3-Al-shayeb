using AlShaibHousing.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;

namespace AlShaibHousing.Api.Controllers;

[ApiController]
[Route("api/backup")]
[Authorize]
public class BackupController(AppDbContext db) : ControllerBase
{
    [HttpGet("download")]
    public async Task<ActionResult> Download()
    {
        try
        {
            var data = new
            {
                exported_at = DateTime.UtcNow,
                users = await db.Users.AsNoTracking().ToListAsync(),
                projects = await db.Projects.AsNoTracking().ToListAsync(),
                customers = await db.Customers.AsNoTracking().ToListAsync(),
                customer_payments = await db.CustomerPayments.AsNoTracking().ToListAsync(),
                categories = await db.Categories.AsNoTracking().ToListAsync(),
                project_expenses = await db.ProjectExpenses.AsNoTracking().ToListAsync(),
                project_expense_payments = await db.ProjectExpensePayments.AsNoTracking().ToListAsync(),
                inventory_items = await db.InventoryItems.AsNoTracking().ToListAsync(),
                inventory_movements = await db.InventoryMovements.AsNoTracking().ToListAsync(),
                external_expenses = await db.ExternalExpenses.AsNoTracking().ToListAsync(),
            };

            var json = JsonSerializer.Serialize(data, new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            });

            var fileName = $"alshaib_backup_{DateTime.UtcNow:yyyy_MM_dd}.json";
            return File(Encoding.UTF8.GetBytes(json), "application/json", fileName);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "فشل تصدير البيانات", error = ex.Message });
        }
    }
}
