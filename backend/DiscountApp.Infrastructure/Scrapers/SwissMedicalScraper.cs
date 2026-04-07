using DiscountApp.Core.Entities;
using DiscountApp.Core.Interfaces;
using Microsoft.Playwright;

namespace DiscountApp.Infrastructure.Scrapers;

public class SwissMedicalScraper : PlaywrightScraperBase, IScraper
{
    public override string BankName => "Swiss Medical";

    public override async Task<IEnumerable<Discount>> ScrapeAsync()
    {
        using var playwright = await Playwright.CreateAsync();
        var browser = await playwright.Chromium.LaunchAsync(new() { Headless = true });
        var page = await CreatePageAsync(browser);
        var discounts = new List<Discount>();

        try
        {
            // Benefits are hosted on Maslow HR platform (Swiss Medical Club)
            await page.GotoAsync("https://app.maslow.hr/dashboard?utm_source=web&utm_medium=bannerhome&utm_campaign=clubswissmedical",
                new() { WaitUntil = WaitUntilState.NetworkIdle, Timeout = 30000 });

            // Scroll to trigger lazy loading
            for (int i = 0; i < 5; i++)
            {
                await page.EvaluateAsync("window.scrollTo(0, document.body.scrollHeight)");
                await page.WaitForTimeoutAsync(1500);
            }

            // Try common card selectors for modern React/Angular SPAs
            var cards = await page.QuerySelectorAllAsync(
                "[class*='benefit'], [class*='BenefitCard'], [class*='card'], article");

            foreach (var card in cards)
            {
                try
                {
                    var titleEl = await card.QuerySelectorAsync("h2, h3, h4, [class*='title'], [class*='nombre']");
                    var title = titleEl != null ? (await titleEl.InnerTextAsync()).Trim() : "";
                    if (string.IsNullOrEmpty(title)) continue;

                    var descEl = await card.QuerySelectorAsync("p, [class*='desc'], [class*='detail']");
                    var description = descEl != null ? (await descEl.InnerTextAsync()).Trim() : "";

                    var imgEl = await card.QuerySelectorAsync("img");
                    string? imageUrl = null;
                    if (imgEl != null)
                    {
                        imageUrl = await imgEl.GetAttributeAsync("src")
                            ?? await imgEl.GetAttributeAsync("data-src");
                        if (!string.IsNullOrEmpty(imageUrl) && imageUrl.StartsWith("/"))
                            imageUrl = "https://www.swissmedical.com.ar" + imageUrl;
                    }

                    var linkEl = await card.QuerySelectorAsync("a");
                    var href = linkEl != null ? await linkEl.GetAttributeAsync("href") : null;
                    var url = href != null && !href.StartsWith("http")
                        ? "https://www.swissmedical.com.ar" + href
                        : href ?? "https://app.maslow.hr/dashboard?utm_campaign=clubswissmedical";

                    var stores = ScraperHelpers.ExtractStores(description + " " + title);

                    decimal? amount = null;
                    string currency = "%";
                    string category = "Varios";

                    var combined = title + " " + description;
                    var is2x1 = System.Text.RegularExpressions.Regex.IsMatch(
                        combined, @"\d+\s*[xX]\s*\d+",
                        System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                    if (is2x1)
                    {
                        category = "Promoción";
                    }
                    else
                    {
                        var match = System.Text.RegularExpressions.Regex.Match(combined, @"(\d+)\s*%");
                        if (match.Success && decimal.TryParse(match.Groups[1].Value, out decimal parsed))
                        {
                            amount = parsed;
                            category = "Ahorro";
                        }

                        if (System.Text.RegularExpressions.Regex.IsMatch(combined,
                            @"(cuotas|csi|sin interés)",
                            System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                        {
                            category = "Financiación";
                        }
                    }

                    discounts.Add(new Discount
                    {
                        Title = title,
                        Description = description,
                        BankName = BankName,
                        ImageUrl = imageUrl,
                        Url = url,
                        Amount = amount,
                        Currency = currency,
                        Category = category,
                        Stores = stores.Count > 0 ? stores : null
                    });
                }
                catch { }
            }
        }
        catch (Exception)
        {
            // Scraper failed silently — returns empty list
        }
        finally
        {
            await browser.CloseAsync();
        }

        return discounts;
    }
}
