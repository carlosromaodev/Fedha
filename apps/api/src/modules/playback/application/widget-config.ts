import { eq } from "drizzle-orm";
import { WidgetConfig } from "@fedha/contracts";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import type { OutputConnection } from "../../../shared/realtime/hub";

export async function tokenRowById(ctx: Ctx, id: string) {
  return ctx.db.query.widgetTokens.findFirst({ where: eq(schema.widgetTokens.id, id) });
}

export async function widgetConfigFor(ctx: Ctx, conn: OutputConnection): Promise<WidgetConfig> {
  const row = conn.tokenId ? await tokenRowById(ctx, conn.tokenId) : null;
  return WidgetConfig.parse(row?.config ?? {});
}
