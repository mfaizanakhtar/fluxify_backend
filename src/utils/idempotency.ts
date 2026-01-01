export function makeIdempotencyKey(orderId: string, lineItemId: string) {
  return `${orderId}::${lineItemId}`;
}
