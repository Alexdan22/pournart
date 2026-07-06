import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";

export default async function AdminInvoicePage(props: PageProps<"/admin/orders/[orderNumber]/invoice">) {
  const { orderNumber } = await props.params;
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { user: true, items: true },
  });

  if (!order) {
    notFound();
  }

  return (
    <section className="print-document">
      <header>
        <div>
          <strong>Pour n Art</strong>
          <span>Handcrafted custom gifts</span>
        </div>
      </header>
      <div className="print-heading">
        <h1>Invoice</h1>
        <span>{order.orderNumber}</span>
      </div>
      <div className="print-grid">
        <section>
          <h2>Bill To</h2>
          <p>{order.user.name}<br />{order.user.email}<br />{order.deliveryPhone}</p>
        </section>
        <section>
          <h2>Ship To</h2>
          <p>{order.deliveryName}<br />{order.deliveryLine1}{order.deliveryLine2 ? `, ${order.deliveryLine2}` : ""}<br />{order.deliveryCity}, {order.deliveryState} - {order.deliveryPincode}</p>
        </section>
      </div>
      <table className="print-table">
        <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td>
                <Image src={item.productImageUrl} alt="" width={42} height={42} />
                {item.productName}
              </td>
              <td>{item.quantity}</td>
              <td>{formatINR(item.unitPrice)}</td>
              <td>{formatINR(item.unitPrice * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="print-total">
        <dt>Subtotal</dt><dd>{formatINR(order.subtotal)}</dd>
        <dt>Shipping</dt><dd>{formatINR(order.shippingFee)}</dd>
        <dt>Discount</dt><dd>{formatINR(order.discount)}</dd>
        <dt>Total</dt><dd>{formatINR(order.total)}</dd>
      </dl>
    </section>
  );
}
