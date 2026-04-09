using DiscountApp.Core.Entities;

namespace DiscountApp.Core.Interfaces;

public interface IScraper
{
    string BankName { get; }
    Task<IEnumerable<Discount>> ScrapeAsync();
}
