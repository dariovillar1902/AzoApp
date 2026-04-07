using DiscountApp.Core.Entities;
using DiscountApp.Core.Interfaces;
using Microsoft.Playwright;
using System.Text.RegularExpressions;

namespace DiscountApp.Infrastructure.Scrapers;

public class SemanaNacionScraper : PlaywrightScraperBase, IScraper
{
    public override string BankName => "Banco Nación";

    public override async Task<IEnumerable<Discount>> ScrapeAsync()
    {
        using var playwright = await Playwright.CreateAsync();
        var browser = await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions { Headless = true });
        var page = await CreatePageAsync(browser);

        var discounts = new List<Discount>();

        try
        {
            await page.GotoAsync("https://semananacion.com.ar/buscador?vista=lista");
            await page.WaitForSelectorAsync("a[class*='ItemV2_item']", new PageWaitForSelectorOptions { Timeout = 30000 });

            // Scroll to load lazy images and more items
            for (int i = 0; i < 8; i++)
            {
                await page.EvaluateAsync("window.scrollTo(0, document.body.scrollHeight)");
                await page.WaitForTimeoutAsync(1500);
                // Force lazy images into their real src
                await page.EvaluateAsync(@"
                    document.querySelectorAll('img[data-src]').forEach(img => {
                        if (!img.src || img.src.startsWith('data:')) img.src = img.dataset.src;
                    });
                ");
            }

            var cards = await page.QuerySelectorAllAsync("a[class*='ItemV2_item']");

            foreach (var card in cards)
            {
                try
                {
                    // URL
                    var href = await card.GetAttributeAsync("href");
                    var startUrl = "https://semananacion.com.ar";
                    if (href != null && !href.StartsWith("http"))
                    {
                         href = startUrl + href;
                    }

                    // Title — try semantic headings first, then class-based, then nth-span fallback
                    var title = "";
                    var headingEl = await card.QuerySelectorAsync("h2, h3, h4");
                    if (headingEl != null)
                        title = (await headingEl.InnerTextAsync()).Trim();

                    if (string.IsNullOrEmpty(title))
                    {
                        var namedEl = await card.QuerySelectorAsync("[class*='title'], [class*='nombre'], [class*='name']");
                        if (namedEl != null)
                            title = (await namedEl.InnerTextAsync()).Trim();
                    }

                    var contentDiv = await card.QuerySelectorAsync("div:nth-of-type(2)");
                    if (string.IsNullOrEmpty(title) && contentDiv != null)
                    {
                        var spanTitle = await contentDiv.QuerySelectorAsync("span:nth-of-type(1)");
                        if (spanTitle != null) title = (await spanTitle.InnerTextAsync()).Trim();
                    }

                    if (string.IsNullOrEmpty(title)) title = "Descuento Nacion";

                    // Description
                    var description = "";
                    if (contentDiv != null)
                    {
                        var spanDesc = await contentDiv.QuerySelectorAsync("span:nth-of-type(2)");
                        if (spanDesc != null) description = await spanDesc.InnerTextAsync();
                    }

                    // Image — handle lazy loading (data-src) and srcset
                    var imgEl = await card.QuerySelectorAsync("img");
                    string? imageUrl = null;
                    if (imgEl != null)
                    {
                        imageUrl = await imgEl.GetAttributeAsync("src");

                        if (string.IsNullOrEmpty(imageUrl) || imageUrl.StartsWith("data:") || imageUrl.Contains("placeholder"))
                            imageUrl = await imgEl.GetAttributeAsync("data-src");

                        if (string.IsNullOrEmpty(imageUrl))
                        {
                            var srcset = await imgEl.GetAttributeAsync("srcset");
                            imageUrl = srcset?.Split(',').FirstOrDefault()?.Trim().Split(' ').FirstOrDefault();
                        }

                        if (!string.IsNullOrEmpty(imageUrl) && imageUrl.StartsWith("/"))
                            imageUrl = "https://semananacion.com.ar" + imageUrl;

                        if (imageUrl != null && (imageUrl.StartsWith("data:") || imageUrl.Length < 10))
                            imageUrl = null;
                    }
                   
                    // Parse Amount and Categories
                    decimal? amount = null;
                    string currency = "%";
                    string category = "Varios";

                    // 1. Check for Percentage
                    var percentMatch = Regex.Match(description, @"(\d+)\s*%");
                    if (percentMatch.Success)
                    {
                         if (decimal.TryParse(percentMatch.Groups[1].Value, out decimal parsedAmount))
                        {
                            amount = parsedAmount;
                        }
                    }
                    
                    // 2. Check for 2x1, 3x2, etc. - Do NOT treat as Amount
                    if (Regex.IsMatch(description, @"\d+\s*[xX]\s*\d+", RegexOptions.IgnoreCase))
                    {
                        // It's a multi-buy promo, keep description as is, amount usually null or 0
                        amount = null; // Ensure we don't accidentally parse "2"
                        category = "Promoción";
                    }

                    // 3. Check for CSI (Cuotas Sin Interés)
                    if (Regex.IsMatch(description, @"(sin interés|csi|cuotas)", RegexOptions.IgnoreCase))
                    {
                        amount = null;
                        category = "Financiación";
                    }

                    var stores = ScraperHelpers.ExtractStores(description);
                    if (stores.Count == 0) stores = ScraperHelpers.ExtractStores(title);

                    discounts.Add(new Discount
                    {
                        Title = title,
                        Description = description,
                        BankName = BankName,
                        ImageUrl = imageUrl,
                        Url = href ?? "https://semananacion.com.ar",
                        Amount = amount,
                        Currency = currency,
                        Category = category,
                        Stores = stores.Count > 0 ? stores : null
                    });
                }
                catch
                {
                    // Ignore errors
                }
            }
        }
        catch (Exception)
        {
           // Log
        }
        finally
        {
            await browser.CloseAsync();
        }

        return discounts;
    }
}
