using DiscountApp.Core.Entities;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace DiscountApp.Infrastructure.Scrapers;

public class SantanderScraper : HttpScraperBase
{
    public override string BankName => "Santander";

    public override async Task<IEnumerable<Discount>> ScrapeAsync()
    {
        var discounts = new List<Discount>();
        try
        {
            // API Found: https://www.santander.com.ar/bff-benefits/brands?page=1&limit=50
            // Returns brands. Each brand has benefits.
            var json = await (new HttpClient()).GetStringAsync("https://www.santander.com.ar/bff-benefits/brands?page=1&limit=50");
            
            var root = JsonNode.Parse(json);
            if (root == null) return discounts;

            var items = root["brands"]?.AsArray();
            if (items == null) items = root["data"]?["brands"]?.AsArray(); // Fallback check

            if (items == null) return discounts;

            foreach (var item in items)
            {
                try
                {
                    // Item is a "Brand". It might have a specific discount inside, or just be the brand.
                    // The API returns "cards".
                    var title = item["name"]?.ToString() ?? "Descuento Santander";
                    var description = item["benefitDescription"]?.ToString() ?? ""; 
                    // Santander usually puts the main promo in 'benefitDescription' e.g. "20% y 3 cuotas"
                    
                    var imgNode = item["images"]?["detail"] ?? item["images"]?["logo"];
                    var imageUrl = imgNode?.ToString();
                    if (!string.IsNullOrEmpty(imageUrl) && !imageUrl.StartsWith("http"))
                    {
                         imageUrl = "https://www.santander.com.ar" + imageUrl; // Sometimes relative
                    }

                    // Parse amount from description
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
                        // amount stays null
                    }
                    else
                    {
                        var match = System.Text.RegularExpressions.Regex.Match(combined, @"(\d+)\s*%");
                        if (match.Success && decimal.TryParse(match.Groups[1].Value, out decimal parsed))
                        {
                            amount = parsed;
                            category = "Ahorro";
                        }

                        if (System.Text.RegularExpressions.Regex.IsMatch(combined, @"(cuotas|csi|sin interés)",
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
                        Url = "https://www.santander.com.ar/personas/beneficios",
                        Amount = amount,
                        Currency = currency,
                        Category = category
                    });
                }
                catch
                {
                    // Ignore
                }
            }
        }
        catch (Exception ex)
        {
             Console.WriteLine($"Error scraping Santander API: {ex.Message}");
        }

        return discounts;
    }
}
