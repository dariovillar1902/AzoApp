using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using DiscountApp.Core.Entities;
using DiscountApp.Core.Interfaces;
using DiscountApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace DiscountApp.Infrastructure.Services
{
    public class ScraperService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<ScraperService> _logger;

        public ScraperService(IServiceProvider serviceProvider, ILogger<ScraperService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        public async Task RunScrapersAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var scrapers = scope.ServiceProvider.GetServices<IScraper>();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            foreach (var scraper in scrapers)
            {
                try
                {
                    _logger.LogInformation($"Starting scraper: {scraper.BankName}");
                    var discounts = await scraper.ScrapeAsync();
                    
                    if (discounts.Any())
                    {
                        await SaveDiscountsAsync(dbContext, discounts, scraper.BankName);
                    }
                    _logger.LogInformation($"Finished scraper: {scraper.BankName}. Found {discounts.Count()} discounts.");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error running scraper {scraper.BankName}");
                }
            }
        }

        private async Task SaveDiscountsAsync(AppDbContext dbContext, IEnumerable<Discount> discounts, string bankName)
        {
            var now = DateTime.UtcNow;

            // Create new instances to avoid mutating the objects returned by the scraper
            var freshDiscounts = discounts.Select(d => new Discount
            {
                Title = d.Title,
                Description = d.Description,
                BankName = d.BankName,
                Category = d.Category,
                Amount = d.Amount,
                Currency = d.Currency,
                ValidDays = d.ValidDays,
                Url = d.Url,
                ImageUrl = d.ImageUrl,
                ExpirationDate = d.ExpirationDate,
                Stores = d.Stores,
                ScrapedAt = now
            }).ToList();

            var oldDiscounts = await dbContext.Discounts
                .Where(d => d.BankName == bankName)
                .ToListAsync();

            dbContext.Discounts.RemoveRange(oldDiscounts);
            await dbContext.Discounts.AddRangeAsync(freshDiscounts);
            await dbContext.SaveChangesAsync();
        }
    }
}
