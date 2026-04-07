using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DiscountApp.Core.Entities;
using DiscountApp.Core.Interfaces;
using Microsoft.Playwright;

namespace DiscountApp.Infrastructure.Scrapers
{
    public class ClubLaNacionScraper : PlaywrightScraperBase
    {
        public override string BankName => "Club La Nacion";
        private const string Url = "https://club.lanacion.com.ar/beneficios";

        public override async Task<IEnumerable<Discount>> ScrapeAsync()
        {
            using var playwright = await Playwright.CreateAsync();
            await using var browser = await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions { Headless = true });
            var page = await CreatePageAsync(browser);

            await page.GotoAsync(Url);
            await page.WaitForSelectorAsync("a.club-card");

            // Scroll down a few times to load more content
            for (int i = 0; i < 5; i++)
            {
                await page.EvaluateAsync("window.scrollTo(0, document.body.scrollHeight)");
                await Task.Delay(2000); // Wait for load
            }

            var elements = await page.QuerySelectorAllAsync("a.club-card");
            var discounts = new List<Discount>();

            foreach (var el in elements)
            {
                try
                {
                    var titleEl = await el.QuerySelectorAsync("h4.club-text");
                    var discountEl = await el.QuerySelectorAsync("span.text-secondary-positive"); // Amount
                    var href = await el.GetAttributeAsync("href");
                    
                    var title = titleEl != null ? await titleEl.InnerTextAsync() : "Unknown";
                    var amountText = discountEl != null ? await discountEl.InnerTextAsync() : null;
                    
                    // Parse category from URL if possible
                    // href example: /beneficios/gastronomia/restaurantes...
                    string category = "General";
                    if (!string.IsNullOrEmpty(href))
                    {
                        var parts = href.Split('/', StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length > 1 && parts[0] == "beneficios")
                        {
                            category = char.ToUpper(parts[1][0]) + parts[1].Substring(1);
                        }
                    }

                    // Try to parse amount
                    decimal? amount = null;
                    if (!string.IsNullOrEmpty(amountText))
                    {
                        var digits = new string(amountText.Where(c => char.IsDigit(c) || c == '.' || c == ',').ToArray());
                        if (decimal.TryParse(digits, out var val))
                        {
                            amount = val;
                        }
                    }
                    
                    // Extract image from style or img tag if present (Not requested strictly but good to have)
                    // For now, skip image extraction to keep it simple or check for img tag inside
                    var imgEl = await el.QuerySelectorAsync("img");
                    var imgUrl = imgEl != null ? await imgEl.GetAttributeAsync("src") : null;

                    var stores = ScraperHelpers.ExtractStores(title);

                    discounts.Add(new Discount
                    {
                        Title = title,
                        BankName = BankName,
                        Category = category,
                        Amount = amount,
                        Currency = amountText?.Contains("%") == true ? "%" : "$",
                        Url = href?.StartsWith("http") == true ? href : $"https://club.lanacion.com.ar{href}",
                        ImageUrl = imgUrl,
                        Stores = stores.Count > 0 ? stores : null
                    });
                }
                catch
                {
                    // Ignore errors for individual cards
                }
            }

            return discounts;
        }
    }
}
