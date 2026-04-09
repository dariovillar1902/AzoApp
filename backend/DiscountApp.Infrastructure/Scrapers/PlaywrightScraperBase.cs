using DiscountApp.Core.Entities;
using DiscountApp.Core.Interfaces;
using Microsoft.Playwright;

namespace DiscountApp.Infrastructure.Scrapers;

public abstract class PlaywrightScraperBase : IScraper
{
    public abstract string BankName { get; }
    public abstract Task<IEnumerable<Discount>> ScrapeAsync();

    protected static async Task<IPage> CreatePageAsync(IBrowser browser)
    {
        var context = await browser.NewContextAsync(new BrowserNewContextOptions
        {
            UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            ViewportSize = new ViewportSize { Width = 1280, Height = 800 }
        });
        return await context.NewPageAsync();
    }
}
