using Microsoft.EntityFrameworkCore;
using DiscountApp.Core.Entities;

namespace DiscountApp.Infrastructure.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Discount> Discounts { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            
            // Configure complex types if necessary
            modelBuilder.Entity<Discount>()
                .Property(d => d.Amount)
                .HasColumnType("decimal(18,2)");
                
            modelBuilder.Entity<Discount>()
                .Property(d => d.ValidDays)
                .HasConversion(
                    v => string.Join(",", v ?? new List<string>()),
                    v => v.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList()
                );

            modelBuilder.Entity<Discount>()
                .Property(d => d.Stores)
                .HasConversion(
                    v => v != null && v.Count > 0 ? string.Join(",", v) : null,
                    v => v != null
                        ? v.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList()
                        : new List<string>()
                );
        }
    }
}
