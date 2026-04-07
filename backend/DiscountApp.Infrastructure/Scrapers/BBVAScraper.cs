using DiscountApp.Core.Entities;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace DiscountApp.Infrastructure.Scrapers;

public class BBVAScraper : HttpScraperBase
{
    public override string BankName => "BBVA";

    public override async Task<IEnumerable<Discount>> ScrapeAsync()
    {
        var discounts = new List<Discount>();
        try
        {
            // API Found: https://go.bbva.com.ar/willgo/fgo/API/v3/communications?destacado=true&pager=0
            // We can iterate pager=0, pager=1 if needed. For now, page 0.
            var json = await (new HttpClient()).GetStringAsync("https://go.bbva.com.ar/willgo/fgo/API/v3/communications?destacado=true&pager=0");
            
            var root = JsonNode.Parse(json);
            if (root == null) return discounts;

            // The JSON structure is: { "code": 0, "message": "...", "data": [...] }
            var items = root["data"]?.AsArray();
            if (items == null) return discounts;

            foreach (var item in items)
            {
                try
                {
                    var title = item["cabecera"]?.ToString() ?? "Descuento BBVA";
                    var description = item["subcabecera"]?.ToString() ?? "";
                    var imageUrl = item["imagen"]?.ToString() ?? null;
                    var link = item["link"]?.ToString() ?? "https://www.bbva.com.ar";

                    // Parsing Amount
                    decimal? amount = null;
                    string currency = "%";
                    string category = "Varios";

                    var combined = title + " " + description;
                    var is2x1 = Regex.IsMatch(combined, @"\d+\s*[xX]\s*\d+", RegexOptions.IgnoreCase);

                    if (is2x1)
                    {
                        category = "Promoción";
                        // amount stays null
                    }
                    else
                    {
                        var match = Regex.Match(combined, @"(\d+)\s*%");
                        if (match.Success && decimal.TryParse(match.Groups[1].Value, out decimal parsed))
                        {
                            amount = parsed;
                            category = "Ahorro";
                        }

                        if (Regex.IsMatch(combined, @"(csi|cuotas sin inter|sin inter)", RegexOptions.IgnoreCase))
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
                        Url = link,
                        Amount = amount,
                        Currency = currency,
                        Category = category
                    });
                }
                catch 
                {
                    // continue
                }
            }
        }
        catch (Exception ex)
        {
             Console.WriteLine($"Error scraping BBVA API: {ex.Message}");
        }

        return discounts;
    }
}
