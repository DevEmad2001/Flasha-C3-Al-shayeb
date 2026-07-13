using System.Text.Json;
using System.Text.Json.Serialization;
using AlShaibHousing.Api.Configuration;
using AlShaibHousing.Api.Data;
using AlShaibHousing.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace AlShaibHousing.Api;

public static class ProgramSetup
{
    public static void ConfigureServices(WebApplicationBuilder builder)
    {
        builder.Services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

        builder.Services.Configure<SeedOptions>(builder.Configuration.GetSection(SeedOptions.SectionName));
        builder.Services.AddScoped<AuthService>();
        builder.Services.AddScoped<InventoryService>();
        builder.Services.AddScoped<SampleDataSeeder>();

        var jwtKey = builder.Configuration["Jwt:Key"]!;
        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = builder.Configuration["Jwt:Issuer"],
                    ValidAudience = builder.Configuration["Jwt:Audience"],
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                    ClockSkew = TimeSpan.FromMinutes(1),
                };
            });

        builder.Services.AddAuthorization();
        builder.Services.AddControllers()
            .AddJsonOptions(o =>
            {
                o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
                o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
                o.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
            });

        builder.Services.AddCors(options =>
        {
            options.AddPolicy("Frontend", policy =>
            {
                if (builder.Environment.IsDevelopment())
                {
                    policy.SetIsOriginAllowed(_ => true);
                }
                else
                {
                    var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
                        ?? ["http://localhost:5173", "http://localhost:8080"];
                    policy.WithOrigins(origins);
                }
                policy.AllowAnyHeader().AllowAnyMethod().AllowCredentials();
            });
        });
    }

    public static async Task ConfigurePipeline(WebApplication app)
    {
        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var sampleSeeder = scope.ServiceProvider.GetRequiredService<SampleDataSeeder>();
            await DbSeeder.SeedAsync(db, app.Configuration, sampleSeeder);
        }

        if (app.Environment.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }

        app.UseCors("Frontend");
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapControllers();
        app.MapGet("/api/health", () => Results.Ok(new { status = "healthy", service = "Al-Shaib Housing API" }));
    }
}
