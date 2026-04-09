using Microsoft.AspNetCore.Mvc;
using DiscountApp.Infrastructure.Services;

namespace DiscountApp.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ScrapeController : ControllerBase
{
    private readonly ScraperService _scraperService;

    public ScrapeController(ScraperService scraperService)
    {
        _scraperService = scraperService;
    }

    [HttpPost]
    public async Task<IActionResult> TriggerScrape()
    {
        await _scraperService.RunScrapersAsync();
        return Ok("Scraping started and completed successfully.");
    }
}
