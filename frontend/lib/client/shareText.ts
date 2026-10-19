import type { PlanResponse } from "../planner/service";
import { storeName } from "../stores/registry";
import { dayLabel, money, promoHeadline } from "./format";

/** Plain-text summary of a plan, for WhatsApp or notes. */
export function planToText(plan: PlanResponse): string {
  const lines: string[] = [];
  for (const stop of plan.stops) {
    lines.push(`🛒 ${storeName(stop.store)} — ${dayLabel(stop.day, plan.days)} — ${money(stop.total)}`);
    if (stop.promotion) {
      const promo = stop.promotion.promotion;
      lines.push(`   ${promoHeadline(promo)}${promo.payment ? ` (${promo.payment})` : ""}: −${money(stop.promotion.discount)}`);
    }
    for (const line of stop.lines) {
      const qty = line.item.quantity > 1 ? `${line.item.quantity}× ` : "";
      lines.push(`   • ${qty}${line.offer.name} ${money(line.listCost)}`);
    }
    lines.push("");
  }
  if (plan.notFound.length > 0) {
    lines.push(`Sin encontrar: ${plan.notFound.map((i) => plan.items[i].item.query).join(", ")}`);
  }
  lines.push(`Total: ${money(plan.total)} (ahorro ${money(plan.listTotal - plan.total)})`);
  return lines.join("\n");
}
