using AlShaibHousing.Api.Controllers;
using AlShaibHousing.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AlShaibHousing.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController(AppDbContext db) : ControllerBase
{
    [HttpGet("stats")]
    public async Task<ActionResult> Stats()
    {
        var projectsCount = await db.Projects.CountAsync();
        var customers = await db.Customers.Select(c => c.TotalAmount).ToListAsync();
        var payments = await db.CustomerPayments.Select(p => p.Amount).ToListAsync();
        var expenses = await db.ExternalExpenses.Select(e => e.Amount).ToListAsync();

        var totalDue = customers.Sum();
        var totalPaid = payments.Sum();
        var totalExpenses = expenses.Sum();

        return Ok(new
        {
            projects_count = projectsCount,
            customers_count = customers.Count,
            total_due = totalDue,
            total_paid = totalPaid,
            remaining = totalDue - totalPaid,
            total_expenses = totalExpenses,
        });
    }
}

[ApiController]
[Route("api/schedule")]
[Authorize]
public class ScheduleController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> GetData()
    {
        var customers = await db.Customers
            .Include(c => c.Project)
            .Select(c => new
            {
                c.Id,
                c.Name,
                project_id = c.ProjectId,
                total_amount = c.TotalAmount,
                down_payment = c.DownPayment,
                monthly_installment = c.MonthlyInstallment,
                start_date = c.StartDate,
                project = c.Project == null ? null : new { c.Project.Name },
            })
            .ToListAsync();

        var payments = await db.CustomerPayments
            .OrderBy(p => p.PaymentDate)
            .Select(p => new { customer_id = p.CustomerId, p.Amount, payment_date = p.PaymentDate })
            .ToListAsync();

        var projects = await db.Projects
            .OrderBy(p => p.Name)
            .Select(p => new { p.Id, p.Name })
            .ToListAsync();

        return Ok(new { customers, payments, projects });
    }
}

[ApiController]
[Route("api/reports")]
[Authorize]
public class ReportsController(AppDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<ActionResult> Summary([FromQuery] DateOnly start, [FromQuery] DateOnly end)
    {
        var cps = await db.CustomerPayments
            .Include(p => p.Customer)
            .Include(p => p.Project)
            .Where(p => p.PaymentDate >= start && p.PaymentDate <= end)
            .ToListAsync();

        var peps = await db.ProjectExpensePayments
            .Include(p => p.Expense).ThenInclude(e => e.Project)
            .Where(p => p.PaymentDate >= start && p.PaymentDate <= end)
            .ToListAsync();

        var exps = await db.ExternalExpenses
            .Where(e => e.ExpenseDate >= start && e.ExpenseDate <= end)
            .ToListAsync();

        var customers = await db.Customers
            .Include(c => c.Payments)
            .ToListAsync();

        return Ok(new
        {
            cps = cps.Select(CustomerPaymentsController.Map),
            peps = peps.Select(ProjectExpensePaymentsController.Map),
            exps,
            customers = customers.Select(c => new
            {
                c.Id,
                c.Name,
                total_amount = c.TotalAmount,
                payments = c.Payments.Select(p => new { p.Amount }),
            }),
        });
    }
}

[ApiController]
[Route("api/daily")]
[Authorize]
public class DailyController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> GetEntries([FromQuery] DateOnly date)
    {
        var cps = await db.CustomerPayments
            .Include(p => p.Customer)
            .Include(p => p.Project)
            .Where(p => p.PaymentDate == date)
            .ToListAsync();

        var peps = await db.ProjectExpensePayments
            .Include(p => p.Expense).ThenInclude(e => e.Project)
            .Where(p => p.PaymentDate == date)
            .ToListAsync();

        var exps = await db.ExternalExpenses
            .Where(e => e.ExpenseDate == date)
            .ToListAsync();

        return Ok(new
        {
            customer_payments = cps.Select(CustomerPaymentsController.Map),
            project_expense_payments = peps.Select(ProjectExpensePaymentsController.Map),
            external_expenses = exps,
        });
    }
}
