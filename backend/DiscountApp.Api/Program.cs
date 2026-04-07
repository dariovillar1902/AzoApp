using DiscountApp.Infrastructure.Data;
using DiscountApp.Infrastructure.Services;
using DiscountApp.Infrastructure.Scrapers;
using DiscountApp.Core.Interfaces;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowLocalhost",
        policy =>
        {
            policy.WithOrigins("http://localhost:8081", "http://10.0.2.2:8081")
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});

// Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=discountapp.db"));

// Services
builder.Services.AddScoped<ScraperService>();
builder.Services.AddScoped<IScraper, ClubLaNacionScraper>();
builder.Services.AddScoped<IScraper, BBVAScraper>();
builder.Services.AddScoped<IScraper, BancoCiudadScraper>();
builder.Services.AddScoped<IScraper, SantanderScraper>();
builder.Services.AddScoped<IScraper, SemanaNacionScraper>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors("AllowLocalhost");

app.UseAuthorization();

app.MapControllers();

// Auto-migrate
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

app.Run();
