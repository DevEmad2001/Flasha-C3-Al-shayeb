using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AlShaibHousing.Api.Data;
using AlShaibHousing.Api.Entities;
using BCrypt.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace AlShaibHousing.Api.Services;

public class AuthService(AppDbContext db, IConfiguration config)
{
    public async Task<(bool Ok, string? Token, string? Error)> LoginAsync(string userName, string password)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.UserName == userName.Trim().ToLowerInvariant());
        if (user is null || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            return (false, null, "Invalid credentials");

        return (true, GenerateToken(user), null);
    }

    public async Task<(bool Ok, string? Error)> ChangePasswordAsync(Guid userId, string newPassword)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null) return (false, "User not found");
        if (newPassword.Length < 6) return (false, "Password too short");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        await db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error, string? NewUsername)> ChangeUsernameAsync(Guid userId, string newUsername)
    {
        var normalized = newUsername.Trim().ToLowerInvariant();
        if (normalized.Length < 2) return (false, "اسم المستخدم قصير جداً", null);
        if (await db.Users.AnyAsync(u => u.UserName == normalized && u.Id != userId))
            return (false, "اسم المستخدم موجود مسبقاً", null);

        var user = await db.Users.FindAsync(userId);
        if (user is null) return (false, "المستخدم غير موجود", null);

        user.UserName = normalized;
        await db.SaveChangesAsync();
        return (true, null, normalized);
    }

    public string GenerateToken(AppUser user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, user.UserName),
            new Claim("display_name", user.DisplayName ?? user.UserName),
        };

        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
