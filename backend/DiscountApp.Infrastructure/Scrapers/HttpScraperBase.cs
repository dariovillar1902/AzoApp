using DiscountApp.Core.Entities;
using DiscountApp.Core.Interfaces;
using HtmlAgilityPack;

namespace DiscountApp.Infrastructure.Scrapers;

public abstract class HttpScraperBase : IScraper
{
    protected readonly HttpClient HttpClient;

    public abstract string BankName { get; }
    public abstract Task<IEnumerable<Discount>> ScrapeAsync();

    protected HttpScraperBase()
    {
        HttpClient = new HttpClient();
        HttpClient.DefaultRequestHeaders.Add(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        );
        HttpClient.Timeout = TimeSpan.FromSeconds(30);
    }

    protected async Task<HtmlDocument> GetDocumentAsync(string url)
    {
        var html = await HttpClient.GetStringAsync(url);
        var doc = new HtmlDocument();
        doc.LoadHtml(html);
        return doc;
    }
}
