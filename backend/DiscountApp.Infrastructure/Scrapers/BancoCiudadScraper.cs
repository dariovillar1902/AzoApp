using DiscountApp.Core.Entities;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace DiscountApp.Infrastructure.Scrapers;

public class BancoCiudadScraper : HttpScraperBase
{
    public override string BankName => "Banco Ciudad";

    public override async Task<IEnumerable<Discount>> ScrapeAsync()
    {
        var discounts = new List<Discount>();
        try
        {
            // API: https://www.bancociudad.com.ar/beneficios_rest/beneficios/busqueda
            // Needs POST usually, or GET with params. The browser analysis suggested "inicializacion" or "busqueda".
            // Let's try "inicializacion" first as it mimics "Load Page".
            // Endpoint: https://www.bancociudad.com.ar/beneficios_rest/beneficios/inicializacion
            
            var client = new HttpClient();
            // Ciudad API requires headers to look like a browser/internal call
            client.DefaultRequestHeaders.Add("Accept", "application/json");
            client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            client.DefaultRequestHeaders.Add("Referer", "https://www.bancociudad.com.ar/institucional/beneficios/");
            client.DefaultRequestHeaders.Add("Origin", "https://www.bancociudad.com.ar");

            var json = await client.GetStringAsync("https://www.bancociudad.com.ar/beneficios_rest/beneficios/inicializacion");
            
            var root = JsonNode.Parse(json);
            if (root == null) return discounts;

            // Structure usually: { "beneficios": [ ... ] } or simple list
            var items = root["beneficios"]?.AsArray();
            
            if (items == null) return discounts;

            foreach (var item in items)
            {
                try
                {
                    var title = item["titulo"]?.ToString() ?? item["nombre"]?.ToString() ?? "Descuento B. Ciudad";
                    var description = item["descripcion"]?.ToString() ?? "";
                    
                    var img = item["imagen"]?.ToString() ?? item["img_cuerpo"]?.ToString();
                    string? imageUrl = null;
                    if (img != null)
                    {
                        imageUrl = "https://www.bancociudad.com.ar" + img;
                    }

                    // Amount Parsing
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
                        Url = "https://www.bancociudad.com.ar/beneficios",
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
             Console.WriteLine($"Error scraping Banco Ciudad API: {ex.Message}");
        }

        return discounts;
    }
}
