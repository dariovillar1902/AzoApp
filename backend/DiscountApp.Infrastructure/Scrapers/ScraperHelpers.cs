using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace DiscountApp.Infrastructure.Scrapers;

public static class ScraperHelpers
{
    // Expand this list as new stores are found in the wild
    private static readonly string[] KnownStores =
    [
        // Supermercados
        "Carrefour", "Coto", "Walmart", "Jumbo", "Disco", "Vea",
        "Día", "La Anónima", "Toledo", "Makro", "Changomas",
        // Electrodomésticos / tecnología
        "Musimundo", "Garbarino", "Fravega", "Cetrogar", "Megatone",
        "Apple", "Samsung",
        // Gastronomía
        "Burger King", "McDonald's", "Mostaza", "Wendy's",
        "Starbucks", "TGI Fridays", "Hard Rock",
        // Delivery / movilidad
        "Cabify", "Rappi", "PedidosYa", "Uber Eats",
        // Combustible
        "Shell", "YPF", "Axion", "Puma",
        // Salud / farmacias
        "Farmacity", "Dr. Ahorro",
        // Ropa / accesorios
        "Falabella", "Ripley", "Zara", "H&M", "Adidas", "Nike",
        // Jugueterías
        "Rasti", "Lego", "Distoyeca", "Top Toys", "Juguetería Educativa",
        // Viajes
        "Despegar", "Booking", "Airbnb",
    ];

    /// <summary>
    /// Returns known store names found in the given text (case-insensitive).
    /// Matches whole words only, so "todos los días" doesn't count as the store "Día".
    /// </summary>
    public static List<string> ExtractStores(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return [];

        return KnownStores
            .Where(store => Regex.IsMatch(
                text,
                $@"(?<![\p{{L}}\p{{N}}]){Regex.Escape(store)}(?![\p{{L}}\p{{N}}])",
                RegexOptions.IgnoreCase))
            .Distinct()
            .ToList();
    }

    private static readonly string[] DayKeys = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    private static readonly string[] DayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    /// <summary>
    /// Spanish weekdays mentioned in a promo text ("lunes a jueves", "sábados y domingos",
    /// "fin de semana"), Monday first. Empty when no day is named (usually "todos los días").
    /// </summary>
    public static List<string> ExtractValidDays(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return [];

        var normalized = RemoveAccents(text.ToLowerInvariant());
        var days = new HashSet<int>();
        var dayAlternation = string.Join("|", DayKeys);

        foreach (Match range in Regex.Matches(normalized, $@"\b({dayAlternation})s? a ({dayAlternation})s?\b"))
        {
            var from = Array.IndexOf(DayKeys, range.Groups[1].Value);
            var to = Array.IndexOf(DayKeys, range.Groups[2].Value);
            for (var i = from; ; i = (i + 1) % 7)
            {
                days.Add(i);
                if (i == to) break;
            }
        }

        for (var i = 0; i < DayKeys.Length; i++)
        {
            if (Regex.IsMatch(normalized, $@"\b{DayKeys[i]}s?\b")) days.Add(i);
        }

        if (normalized.Contains("fin de semana"))
        {
            days.Add(6);
            days.Add(0);
        }

        return days.OrderBy(i => (i + 6) % 7).Select(i => DayNames[i]).ToList();
    }

    private static string RemoveAccents(string text)
    {
        var decomposed = text.Normalize(NormalizationForm.FormD);
        var chars = decomposed.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark);
        return new string(chars.ToArray()).Normalize(NormalizationForm.FormC);
    }
}
