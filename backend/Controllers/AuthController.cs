using System.Security.Claims;
using System.Text.Json.Serialization;
using AlShaibHousing.Api.Data;
using AlShaibHousing.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AlShaibHousing.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, AuthService auth) : ControllerBase
{
    public record LoginRequest(
        [property: JsonPropertyName("username")] string Username,
        [property: JsonPropertyName("password")] string Password);
    public record LoginResponse(string Token, string Username, string DisplayName);
    public record ChangePasswordRequest(string NewPassword);
    public record ChangeUsernameRequest(string NewUsername);

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest req)
    {
        var (ok, token, _) = await auth.LoginAsync(req.Username, req.Password);
        if (!ok || token is null)
            return Unauthorized(new { message = "اسم المستخدم أو كلمة السر غير صحيحة" });

        var user = await db.Users.FirstAsync(u => u.UserName == req.Username.Trim().ToLowerInvariant());
        return Ok(new LoginResponse(token, user.UserName, user.DisplayName ?? user.UserName));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<object>> Me()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (sub is null || !Guid.TryParse(sub, out var id))
            return Unauthorized();

        var user = await db.Users.FindAsync(id);
        if (user is null) return NotFound();
        return Ok(new { username = user.UserName, display_name = user.DisplayName ?? user.UserName });
    }

    [Authorize]
    [HttpPut("password")]
    public async Task<ActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (sub is null || !Guid.TryParse(sub, out var id))
            return Unauthorized();

        var (ok, error) = await auth.ChangePasswordAsync(id, req.NewPassword);
        if (!ok) return BadRequest(new { message = error });
        return NoContent();
    }

    [Authorize]
    [HttpPut("username")]
    public async Task<ActionResult> ChangeUsername([FromBody] ChangeUsernameRequest req)
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (sub is null || !Guid.TryParse(sub, out var id))
            return Unauthorized();

        var (ok, error, newUsername) = await auth.ChangeUsernameAsync(id, req.NewUsername);
        if (!ok) return BadRequest(new { message = error });
        return Ok(new { username = newUsername });
    }
}
