using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DiscountApp.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddStores : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Stores",
                table: "Discounts",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Stores",
                table: "Discounts");
        }
    }
}
