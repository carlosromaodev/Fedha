import { randomBytes, randomUUID } from "node:crypto";

export const uuid = () => randomUUID();
const hex = (n: number) => randomBytes(n).toString("hex").toUpperCase();
/** Número de pedido legível, ex.: FL-8F3A-22C1 */
export const orderId = () => `FL-${hex(2)}-${hex(2)}`;
export const withdrawalId = () => `LV-${hex(3)}`;
export const ticketId = () => `TK-${hex(3)}`;
export const kycId = () => `KYC-${hex(3)}`;
/** Token secreto para URLs (overlay, Player, convites). */
export const secretToken = (bytes = 18) => randomBytes(bytes).toString("base64url");
export const numericCode = (digits = 6) => {
  const max = 10 ** digits;
  return (randomBytes(4).readUInt32BE() % max).toString().padStart(digits, "0");
};
