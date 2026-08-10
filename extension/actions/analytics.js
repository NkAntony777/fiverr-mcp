if (!self.FMcp) self.FMcp = {};

// Fiverr analytics endpoints (current versions):
// - Dashboard summary: GET /seller-dashboard-page/api/analyticsData?batch=1&input={}
// - Orders & revenue trend: GET /users/{username}/seller_analytics_graph_data?type={timeframe}
//   (timeframes: "30-days-back" | "3-months-back" | "yearly")

self.FMcp.get_analytics = async function({ gigId, from, to } = {}) {
  const out = { summary: {}, graphs: {}, gigs: [] };

  // 1) Dashboard summary (earned this month, active orders total)
  try {
    const input = encodeURIComponent('{}');
    const resp = await fetch(`/seller-dashboard-page/api/analyticsData?batch=1&input=${input}`, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });
    if (resp.ok) {
      const body = await resp.json();
      const payload = Array.isArray(body) ? body[0] : body;
      const data = payload?.result?.data ?? payload?.data ?? payload;
      if (data?.earnedThisMonth)     out.summary.earned_this_month  = data.earnedThisMonth;
      if (data?.activeOrdersTotal)   out.summary.active_orders_total = data.activeOrdersTotal;
    }
  } catch (_) {}

  // 2) Orders & revenue trend from the seller analytics graph API
  const username = (() => {
    const m = window.location.pathname.match(/\/users\/([^/]+)/);
    if (m) return m[1];
    const link = document.querySelector('a[href*="seller_analytics_dashboard"]');
    if (link) {
      try { return new URL(link.href).pathname.match(/\/users\/([^/]+)/)?.[1] ?? null; } catch (_) {}
    }
    return null;
  })();

  if (username) {
    let timeframes = [];
    if (from && to) {
      const days = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
      timeframes.push(days > 60 ? '3-months-back' : '30-days-back');
    } else {
      timeframes = ['30-days-back', '3-months-back', 'yearly'];
    }

    for (const type of timeframes) {
      try {
        const resp = await fetch(`/users/${username}/seller_analytics_graph_data?type=${encodeURIComponent(type)}`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' },
        });
        if (resp.ok) {
          const data = await resp.json();
          out.graphs[type] = {
            orders_and_revenue_data: Array.isArray(data.orders_and_revenue_data) ? data.orders_and_revenue_data : [],
            guides_data:             Array.isArray(data.guides_data) ? data.guides_data : [],
          };
        }
      } catch (_) {}
    }
  }

  // Note: per-gig impressions/clicks/orders now live on the manage_gigs table —
  // use list_gigs for that data.
  out.note = 'Per-gig impressions/clicks/orders come from the manage_gigs page — see list_gigs';

  return out;
};
