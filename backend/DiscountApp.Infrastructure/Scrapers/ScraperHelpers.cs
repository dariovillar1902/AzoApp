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
    /// </summary>
    public static List<string> ExtractStores(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return [];

        return KnownStores
            .Where(store => text.Contains(store, StringComparison.OrdinalIgnoreCase))
            .Distinct()
            .ToList();
    }
}
