import Image from "next/image";
import { AlertTriangle, PackagePlus } from "lucide-react";
import { restockProductAction } from "@/app/actions/admin";
import { reservedInventoryByProduct } from "@/lib/admin-data";
import { prisma } from "@/lib/db";

export default async function AdminInventoryPage() {
  const products = await prisma.product.findMany({
    where: { adminStatus: { not: "ARCHIVED" } },
    include: { category: true, inventoryAdjustments: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: [{ inventory: "asc" }, { updatedAt: "desc" }],
  });
  const reserved = await reservedInventoryByProduct(products.map((product) => product.id));

  return (
    <section className="admin-route">
      <div className="admin-page-heading">
        <div>
          <span>Inventory</span>
          <h1>Stock control</h1>
        </div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table inventory-table">
          <thead>
            <tr><th>Product</th><th>Current Stock</th><th>Reserved</th><th>Available</th><th>Low Stock Warning</th><th>Out of Stock</th><th>Restock</th></tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const reservedCount = reserved.get(product.id) ?? 0;
              const available = product.inventory - reservedCount;
              const needsAttention = available <= product.lowStockThreshold;

              return (
                <tr className={needsAttention ? "needs-attention" : ""} key={product.id}>
                  <td>
                    <span className="product-cell">
                      <Image src={product.imageUrl} alt="" width={46} height={46} />
                      <span><strong>{product.name}</strong><small>{product.category.name}</small></span>
                    </span>
                  </td>
                  <td>{product.inventory}</td>
                  <td>{reservedCount}</td>
                  <td>{available}</td>
                  <td>{product.lowStockThreshold}</td>
                  <td>{available <= 0 ? <span className="status-pill payment-failed">Out</span> : "No"}</td>
                  <td>
                    <form className="restock-form" action={restockProductAction}>
                      <input type="hidden" name="productId" value={product.id} />
                      <input name="delta" type="number" placeholder="+5" />
                      <input name="reason" type="hidden" value="RESTOCK" />
                      <button className="icon-action" type="submit" aria-label={`Restock ${product.name}`}>
                        {needsAttention ? <AlertTriangle aria-hidden size={15} /> : <PackagePlus aria-hidden size={15} />}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
