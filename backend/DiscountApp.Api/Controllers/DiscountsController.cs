using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DiscountApp.Core.Entities;
using DiscountApp.Infrastructure.Data;

namespace DiscountApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DiscountsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DiscountsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Discount>>> GetDiscounts(string? bank = null, string? category = null, string? search = null)
        {
            var query = _context.Discounts.AsQueryable();

            // Exclude discounts scraped more than 7 days ago
            var staleCutoff = DateTime.UtcNow.AddDays(-7);
            query = query.Where(d => d.ScrapedAt >= staleCutoff);

            // Exclude explicitly expired discounts
            var now = DateTime.UtcNow;
            query = query.Where(d => d.ExpirationDate == null || d.ExpirationDate >= now);

            if (!string.IsNullOrEmpty(bank))
                query = query.Where(d => d.BankName == bank);

            if (!string.IsNullOrEmpty(category))
                query = query.Where(d => d.Category != null && d.Category.Contains(category));

            if (!string.IsNullOrEmpty(search))
                query = query.Where(d =>
                    d.Title.Contains(search) ||
                    (d.Description != null && d.Description.Contains(search)));

            var results = await query.ToListAsync();

            // Expose last-update date as a response header
            var lastUpdated = results.Any() ? results.Max(d => d.ScrapedAt) : DateTime.MinValue;
            Response.Headers.Append("X-Last-Updated", lastUpdated.ToString("O"));

            return Ok(results);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Discount>> GetDiscount(int id)
        {
            var discount = await _context.Discounts.FindAsync(id);
            if (discount == null)
            {
                return NotFound();
            }
            return discount;
        }
    }
}
