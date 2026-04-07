using System;

namespace DiscountApp.Core.Entities
{
    public class Discount
    {
        public int Id { get; set; }
        public required string Title { get; set; }
        public string? Description { get; set; }
        public string? BankName { get; set; } // e.g. "Santander", "BBVA"
        public string? Category { get; set; } // e.g. "Gastronomía"
        public decimal? Amount { get; set; } // Percentage or fixed amount
        public string? Currency { get; set; } // "%" or "$"
        public List<string>? ValidDays { get; set; } = new(); // e.g. ["Monday", "Friday"]
        public string? Url { get; set; }
        public string? ImageUrl { get; set; }
        public DateTime? ExpirationDate { get; set; }
        public DateTime ScrapedAt { get; set; } = DateTime.UtcNow;
        public List<string>? Stores { get; set; } = new();
    }
}
