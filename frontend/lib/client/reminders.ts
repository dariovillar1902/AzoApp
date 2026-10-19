import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { PlanDay } from "../benefits/eligibility";
import type { Promotion } from "../benefits/types";

const REMINDER_HOUR = 9;

export type ReminderResult = "scheduled" | "denied" | "unsupported" | "past";

/** Local notifications only exist on the phone; the web build reports "unsupported". */
async function ensurePermission(): Promise<ReminderResult | null> {
  if (Platform.OS === "web") return "unsupported";
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Recordatorios",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  return granted ? null : "denied";
}

/** One-off reminder at 9:00 on a visit's day ("Hoy: Día con BNA+ MODO, 20%"). */
export async function remindVisit(day: PlanDay, title: string, body: string): Promise<ReminderResult> {
  const blocked = await ensurePermission();
  if (blocked) return blocked;

  const [y, m, d] = day.date.split("-").map(Number);
  const date = new Date(y, m - 1, d, REMINDER_HOUR, 0, 0);
  if (date.getTime() <= Date.now()) return "past";

  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
  return "scheduled";
}

/** Weekly reminder on each of a promo's days. Returns the notification ids so it can be cancelled. */
export async function remindPromoWeekly(promo: Promotion, title: string, body: string): Promise<{ result: ReminderResult; ids: string[] }> {
  const blocked = await ensurePermission();
  if (blocked) return { result: blocked, ids: [] };

  const days = promo.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6];
  const ids = await Promise.all(
    days.map((dow) =>
      Notifications.scheduleNotificationAsync({
        content: { title, body },
        // expo-notifications counts weekdays 1 (Sunday) to 7 (Saturday).
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: dow + 1, hour: REMINDER_HOUR, minute: 0 },
      }),
    ),
  );
  return { result: "scheduled", ids };
}

export async function cancelReminders(ids: string[]): Promise<void> {
  if (Platform.OS === "web") return;
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

export function reminderMessage(result: ReminderResult, what: string): string {
  switch (result) {
    case "scheduled":
      return `Te aviso ${what} a las ${REMINDER_HOUR}:00.`;
    case "denied":
      return "Activá las notificaciones para AzoApp en los ajustes del teléfono.";
    case "past":
      return "Es hoy: ya pasó la hora del recordatorio.";
    case "unsupported":
      return "Los recordatorios funcionan en la app del celular, no en la web.";
  }
}
