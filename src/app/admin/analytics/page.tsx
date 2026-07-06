import { monthRange, todayRange } from "@/lib/admin-data";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";

function pct(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}

function bars(values: { label: string; value: number }[]) {
  const max = Math.max(1, ...values.map((item) => item.value));

  return (
    <div className="mini-bar-chart">
      {values.map((item) => (
        <span style={{ "--bar": `${(item.value / max) * 100}%` } as React.CSSProperties} key={item.label}>
          <i />
          <small>{item.label}</small>
        </span>
      ))}
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  const month = monthRange();
  const today = todayRange();
  const [orders, paidOrders, checkoutStarts, topItems, products, categories, events] = await Promise.all([
    prisma.order.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.order.findMany({ where: { paymentStatus: "PAID" }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.analyticsEvent.count({ where: { event: "CHECKOUT_STARTED" } }),
    prisma.orderItem.findMany({
      where: { order: { paymentStatus: "PAID" } },
      include: { product: { include: { category: true } } },
      take: 1000,
    }),
    prisma.product.findMany({ include: { category: true } }),
    prisma.category.findMany(),
    prisma.analyticsEvent.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  const revenue = paidOrders.reduce((total, order) => total + order.total, 0);
  const monthRevenue = paidOrders
    .filter((order) => order.createdAt >= month.start && order.createdAt < month.end)
    .reduce((total, order) => total + order.total, 0);
  const todayRevenue = paidOrders
    .filter((order) => order.createdAt >= today.start && order.createdAt < today.end)
    .reduce((total, order) => total + order.total, 0);
  const averageOrder = paidOrders.length ? revenue / paidOrders.length : 0;
  const conversion = checkoutStarts ? (paidOrders.length / checkoutStarts) * 100 : 0;
  const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();
  const categorySales = new Map<string, { name: string; quantity: number; revenue: number }>();

  for (const item of topItems) {
    const productKey = item.productId || item.productName;
    const currentProduct = productSales.get(productKey) || { name: item.productName, quantity: 0, revenue: 0 };
    currentProduct.quantity += item.quantity;
    currentProduct.revenue += item.unitPrice * item.quantity;
    productSales.set(productKey, currentProduct);

    const categoryName = item.product?.category.name || "Uncategorized";
    const currentCategory = categorySales.get(categoryName) || { name: categoryName, quantity: 0, revenue: 0 };
    currentCategory.quantity += item.quantity;
    currentCategory.revenue += item.unitPrice * item.quantity;
    categorySales.set(categoryName, currentCategory);
  }

  const monthly = Array.from({ length: 6 }).map((_, offset) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - offset));
    const label = date.toLocaleString("en-IN", { month: "short" });
    const value = paidOrders
      .filter((order) => order.createdAt.getMonth() === date.getMonth() && order.createdAt.getFullYear() === date.getFullYear())
      .reduce((total, order) => total + order.total, 0);
    return { label, value };
  });
  const repeatCustomerIds = new Set(
    orders
      .reduce((map, order) => map.set(order.userId, (map.get(order.userId) || 0) + 1), new Map<string, number>())
      .entries(),
  );
  const repeatCustomers = Array.from(repeatCustomerIds).filter(([, count]) => count > 1).length;
  const heatmap = Array.from({ length: 7 }).map((_, day) => ({
    day,
    count: paidOrders.filter((order) => order.createdAt.getDay() === day).length,
  }));

  return (
    <section className="admin-route">
      <div className="admin-page-heading">
        <div>
          <span>Analytics</span>
          <h1>Store performance</h1>
        </div>
      </div>
      <div className="admin-metric-grid">
        <div className="admin-metric-card"><span>Revenue</span><strong>{formatINR(revenue)}</strong></div>
        <div className="admin-metric-card"><span>Orders</span><strong>{orders.length}</strong></div>
        <div className="admin-metric-card"><span>Average Order Value</span><strong>{formatINR(averageOrder)}</strong></div>
        <div className="admin-metric-card"><span>Conversion</span><strong>{pct(conversion)}</strong></div>
        <div className="admin-metric-card"><span>Today</span><strong>{formatINR(todayRevenue)}</strong></div>
        <div className="admin-metric-card"><span>This Month</span><strong>{formatINR(monthRevenue)}</strong></div>
        <div className="admin-metric-card"><span>Repeat Customers</span><strong>{repeatCustomers}</strong></div>
        <div className="admin-metric-card"><span>Tracked Events</span><strong>{events.length}</strong></div>
      </div>
      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading"><h2>Monthly Revenue Graph</h2></div>
          {bars(monthly.map((item) => ({ ...item, value: item.value / 100 })))}
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading"><h2>Sales Heatmap</h2></div>
          <div className="sales-heatmap">
            {heatmap.map((cell) => (
              <span style={{ opacity: 0.25 + Math.min(0.75, cell.count / 8) }} key={cell.day}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][cell.day]}<strong>{cell.count}</strong>
              </span>
            ))}
          </div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading"><h2>Top Products</h2></div>
          <div className="admin-compact-list">
            {Array.from(productSales.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8).map((item) => (
              <p key={item.name}><strong>{item.name}</strong><small>{item.quantity} sold / {formatINR(item.revenue)}</small></p>
            ))}
            {products.length === 0 ? <p>No products yet.</p> : null}
          </div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading"><h2>Top Categories</h2></div>
          <div className="admin-compact-list">
            {Array.from(categorySales.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8).map((item) => (
              <p key={item.name}><strong>{item.name}</strong><small>{item.quantity} sold / {formatINR(item.revenue)}</small></p>
            ))}
            {categories.length === 0 ? <p>No categories yet.</p> : null}
          </div>
        </section>
        <section className="admin-panel span-2">
          <div className="admin-panel-heading"><h2>Recent Trends</h2></div>
          <div className="admin-stat-row">
            <span><strong>{events.filter((event) => event.event === "PRODUCT_VIEWED").length}</strong>Product views</span>
            <span><strong>{events.filter((event) => event.event === "ADD_TO_CART").length}</strong>Add to carts</span>
            <span><strong>{events.filter((event) => event.event === "CHECKOUT_STARTED").length}</strong>Checkout starts</span>
            <span><strong>{events.filter((event) => event.event === "ORDER_PAID").length}</strong>Paid events</span>
          </div>
        </section>
      </div>
    </section>
  );
}
