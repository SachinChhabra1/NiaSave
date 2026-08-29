async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `request_failed_${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

export const api = {
  catalog: () => request("/v1/catalog"),
  work: () => request("/v1/work/current"),
  nest: () => request("/v1/nest/current"),
  home: () => request("/v1/home/leftover"),
  lookup: (phone) => request("/v1/members/lookup", { method: "POST", body: JSON.stringify({ phone }) }),
  decideExtra: (decision) => request("/v1/work/extras/extra-tonight/decision", {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ decision })
  }),
  rsvp: (coming) => request("/v1/nest/events/bada-khaana/rsvp", {
    method: "POST",
    body: JSON.stringify({ coming })
  }),
  checkout: async ({ amount, cart, memberId }) => {
    const payment = await request("/v1/payments", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ amount, cart, memberId })
    });
    return request("/v1/orders", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ paymentId: payment.id })
    });
  },
  transferHome: () => request("/v1/home/transfers", { method: "POST", body: "{}" })
};
