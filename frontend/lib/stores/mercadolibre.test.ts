import { describe, expect, it } from "vitest";
import { parseListing } from "./mercadolibre";

const card = (title: string, price: string, previous?: string) => `
<li class="ui-search-layout__item"><div class="andes-card poly-card poly-card--list"><div class="poly-card__portada">
<img class="poly-component__picture" src="https://http2.mlstatic.com/D_Q_NP_1-O.webp"></div>
<h3 class="poly-component__title-wrapper"><a href="https://articulo.mercadolibre.com.ar/MLA-123456-yerba#polycard" class="poly-component__title">${title}</a></h3>
<div class="poly-component__price">${previous ? `<s class="andes-money-amount andes-money-amount--previous"><span class="andes-money-amount__fraction">${previous}</span></s>` : ""}
<div class="poly-price__current"><span class="andes-money-amount__fraction" aria-hidden="true">${price}</span></div></div></div></li>`;

describe("parseListing", () => {
  it("reads title, current and previous price, link and size", () => {
    const [offer] = parseListing(card("Yerba Mate Playadito 1 Kg", "4.250", "5.100"));
    expect(offer).toMatchObject({
      site: "mercadolibre",
      id: "MLA123456",
      name: "Yerba Mate Playadito 1 Kg",
      price: 4250,
      listPrice: 5100,
      url: "https://articulo.mercadolibre.com.ar/MLA-123456-yerba",
      sizeUnit: "g",
      sizeValue: 1000,
    });
  });

  it("skips cards without a price", () => {
    expect(parseListing(card("Sin precio", "")).length).toBe(0);
  });
});
