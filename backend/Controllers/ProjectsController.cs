using AlShaibHousing.Api.Data;
using AlShaibHousing.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AlShaibHousing.Api.Controllers;

[ApiController]
[Route("api/projects")]
[Authorize]
public class ProjectsController(AppDbContext db) : ControllerBase
{
    public record ProjectDto(string? Name, string? Location, string? OwnerName, string? Notes);

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] string? fields)
    {
        var query = db.Projects.AsQueryable();
        if (fields == "list")
        {
            return Ok(await query.OrderBy(p => p.Name)
                .Select(p => new { p.Id, p.Name, owner_name = p.OwnerName })
                .ToListAsync());
        }
        if (fields == "minimal")
        {
            return Ok(await query.OrderBy(p => p.Name)
                .Select(p => new { p.Id, p.Name })
                .ToListAsync());
        }

        return Ok(await query.OrderByDescending(p => p.CreatedAt).ToListAsync());
    }

    [HttpGet("stats")]
    public async Task<ActionResult> Stats()
    {
        var customers = await db.Customers.Select(c => new { c.ProjectId, c.TotalAmount }).ToListAsync();
        var payments = await db.CustomerPayments.Select(p => new { p.ProjectId, p.Amount }).ToListAsync();
        var map = new Dictionary<string, ProjectStats>();

        foreach (var c in customers.Where(x => x.ProjectId.HasValue))
        {
            var id = c.ProjectId!.Value.ToString();
            if (!map.TryGetValue(id, out var s)) s = new ProjectStats();
            s.Customers++;
            s.Due += c.TotalAmount;
            map[id] = s;
        }
        foreach (var p in payments.Where(x => x.ProjectId.HasValue))
        {
            var id = p.ProjectId!.Value.ToString();
            if (!map.TryGetValue(id, out var s)) s = new ProjectStats();
            s.Paid += p.Amount;
            map[id] = s;
        }

        return Ok(map);
    }

    private sealed class ProjectStats
    {
        public int Customers { get; set; }
        public decimal Due { get; set; }
        public decimal Paid { get; set; }
    }

    [HttpPost]
    public async Task<ActionResult<Project>> Create([FromBody] ProjectDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "اسم الإسكان مطلوب" });

        var project = new Project
        {
            Name = dto.Name.Trim(),
            Location = dto.Location,
            OwnerName = dto.OwnerName,
            Notes = dto.Notes,
        };
        db.Projects.Add(project);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(List), new { id = project.Id }, project);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult> Update(Guid id, [FromBody] ProjectDto dto)
    {
        var project = await db.Projects.FindAsync(id);
        if (project is null) return NotFound();
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "اسم الإسكان مطلوب" });

        project.Name = dto.Name.Trim();
        project.Location = dto.Location;
        project.OwnerName = dto.OwnerName;
        project.Notes = dto.Notes;
        await db.SaveChangesAsync();
        return Ok(project);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id)
    {
        var project = await db.Projects.FindAsync(id);
        if (project is null) return NotFound();
        db.Projects.Remove(project);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
