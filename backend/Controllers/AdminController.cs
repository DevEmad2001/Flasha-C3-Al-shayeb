using AlShaibHousing.Api.Configuration;
using AlShaibHousing.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace AlShaibHousing.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize]
public class AdminController(SampleDataSeeder sampleSeeder, IOptions<SeedOptions> seedOptions) : ControllerBase
{
    [HttpGet("seed/status")]
    public async Task<ActionResult> SeedStatus()
    {
        var opts = seedOptions.Value;
        var counts = await sampleSeeder.GetCountsAsync();
        return Ok(new
        {
            config = new
            {
                sample_data_enabled = opts.SampleData.Enabled,
                only_if_empty = opts.SampleData.OnlyIfEmpty,
                include_demo_users = opts.SampleData.IncludeDemoUsers,
                allow_admin_reset = opts.SampleData.AllowAdminReset,
                allow_admin_clear = opts.SampleData.AllowAdminClear,
                admin_user = opts.AdminUser,
            },
            counts,
            demo_users = opts.SampleData.IncludeDemoUsers
                ? new[]
                {
                    new { username = opts.AdminUser, password = opts.AdminPassword, role = "مدير النظام" },
                    new { username = "manager", password = "Manager@123", role = "مدير العمليات" },
                    new { username = "accountant", password = "Accountant@123", role = "المحاسب" },
                }
                : new[] { new { username = opts.AdminUser, password = opts.AdminPassword, role = "مدير النظام" } },
            test_scenarios = new[]
            {
                "زبون دفع كامل (أحمد محمود)",
                "زبون أقساط جزئية (سارة يوسف)",
                "زبون متأخر في الدفع (عمر حسن)",
                "زبون دفعة أولى فقط (ليلى خالد)",
                "زبون بدون مشروع (محمود عيسى)",
                "مصاريف مشروع مدفوعة جزئياً",
                "حركات مخزون دخول/خروج",
                "مصاريف خارجية + حركات اليوم",
            },
        });
    }

    [HttpPost("seed/run")]
    public async Task<ActionResult> RunSeed([FromQuery] bool force = false)
    {
        if (!seedOptions.Value.SampleData.Enabled)
            return BadRequest(new { message = "تفعيل Seed:SampleData:Enabled في appsettings مطلوب." });

        if (force && !seedOptions.Value.SampleData.AllowAdminReset)
            return BadRequest(new { message = "إعادة التعيين معطّلة في الإعدادات (AllowAdminReset)." });

        var result = await sampleSeeder.SeedAsync(force);
        if (!result.Ok)
            return Conflict(new { message = result.Message, counts = result.Counts });

        return Ok(new { message = result.Message, counts = result.Counts });
    }

    [HttpPost("data/clear")]
    public async Task<ActionResult> ClearData()
    {
        if (!seedOptions.Value.SampleData.AllowAdminClear)
            return BadRequest(new { message = "مسح البيانات معطّل في الإعدادات (AllowAdminClear)." });

        await sampleSeeder.ClearBusinessDataAsync();
        var counts = await sampleSeeder.GetCountsAsync();
        return Ok(new { message = "تم مسح جميع البيانات بنجاح مع الاحتفاظ بحسابات المستخدمين.", counts });
    }

    [HttpPost("seed/reset")]
    public async Task<ActionResult> ResetAndSeed()
    {
        if (!seedOptions.Value.SampleData.AllowAdminReset)
            return BadRequest(new { message = "إعادة التعيين معطّلة في الإعدادات." });

        if (!seedOptions.Value.SampleData.Enabled)
            return BadRequest(new { message = "تفعيل Seed:SampleData:Enabled مطلوب." });

        var result = await sampleSeeder.SeedAsync(force: true);
        return Ok(new { message = "تم مسح البيانات وإعادة البيانات التجريبية.", counts = result.Counts });
    }
}
