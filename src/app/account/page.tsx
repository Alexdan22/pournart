import Link from "next/link";
import { LogOut, MapPin, PackageCheck, ShoppingBag, Trash2, UserRound } from "lucide-react";
import { deleteAddressAction } from "@/app/actions/account";
import { logoutAction } from "@/app/actions/auth";
import { getOrderStatusLabel } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { requireUser } from "@/lib/session";

function formatAddress(address: {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
}) {
  return [address.line1, address.line2, address.city, address.state, address.pincode, address.country]
    .filter(Boolean)
    .join(", ");
}

export default async function AccountPage() {
  const session = await requireUser();
  const [user, orders, orderCount, savedAddresses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: {
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.order.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.order.count({ where: { userId: session.id } }),
    prisma.address.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <section className="account-page">
      <div className="section-heading heading-row">
        <div>
          <span className="panel-label">Account</span>
          <h1>Hello, {user?.name ?? session.name}</h1>
          <p>Your profile, saved delivery addresses, and recent handcrafted orders live here.</p>
        </div>
        <form action={logoutAction}>
          <button className="secondary-button" type="submit">
            <LogOut aria-hidden size={18} /> Logout
          </button>
        </form>
      </div>

      <div className="account-stats">
        <div>
          <span>Orders placed</span>
          <strong>{orderCount}</strong>
        </div>
        <div>
          <span>Saved addresses</span>
          <strong>{savedAddresses.length}</strong>
        </div>
        <div>
          <span>Member since</span>
          <strong>{user?.createdAt ? user.createdAt.getFullYear() : "Now"}</strong>
        </div>
      </div>

      <div className="account-layout">
        <div className="account-main">
          <section className="account-panel profile-panel">
            <div className="account-panel-heading">
              <UserRound aria-hidden size={22} />
              <div>
                <span className="panel-label">Profile details</span>
                <h2>{user?.name ?? session.name}</h2>
              </div>
            </div>
            <dl className="profile-list">
              <div>
                <dt>Email</dt>
                <dd>{user?.email ?? session.email}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{user?.phone || "Added after your first checkout"}</dd>
              </div>
              <div>
                <dt>Account type</dt>
                <dd>{user?.role === "ADMIN" ? "Admin" : "Customer"}</dd>
              </div>
            </dl>
          </section>

          <section className="account-panel">
            <div className="account-panel-heading">
              <MapPin aria-hidden size={22} />
              <div>
                <span className="panel-label">Address book</span>
                <h2>Saved delivery addresses</h2>
              </div>
            </div>
            {savedAddresses.length > 0 ? (
              <div className="address-card-list">
                {savedAddresses.map((address) => (
                  <article className="saved-address-card" key={address.id}>
                    <div>
                      <strong>{address.label}</strong>
                      <p>{formatAddress(address)}</p>
                    </div>
                    <form action={deleteAddressAction}>
                      <input type="hidden" name="addressId" value={address.id} />
                      <button className="icon-link" type="submit" aria-label={`Delete ${address.label} address`}>
                        <Trash2 aria-hidden size={17} />
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            ) : (
              <div className="soft-empty">
                <p>No saved addresses yet. Your next checkout can save one for faster future orders.</p>
                <Link className="secondary-button" href="/products">
                  Explore collections
                </Link>
              </div>
            )}
          </section>

          <section className="account-panel">
            <div className="account-panel-heading">
              <PackageCheck aria-hidden size={22} />
              <div>
                <span className="panel-label">Recent orders</span>
                <h2>Track your custom gifts</h2>
              </div>
            </div>
            {orders.length > 0 ? (
              <div className="orders-list">
                {orders.map((order) => (
                  <Link className="order-row" href={`/orders/${order.orderNumber}`} key={order.id}>
                    <span>{order.orderNumber}</span>
                    <strong>{formatINR(order.total)}</strong>
                    <small>{getOrderStatusLabel(order.status)}</small>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="soft-empty">
                <p>No orders yet. Start with a gift-ready piece or custom gift.</p>
                <Link className="primary-button" href="/products">
                  Shop collections
                </Link>
              </div>
            )}
          </section>
        </div>

        <aside className="account-panel account-shortcuts">
          <span className="panel-label">Quick navigation</span>
          <h2>Where would you like to go?</h2>
          <Link href="/products">
            <ShoppingBag aria-hidden size={18} />
            Collections
          </Link>
          <Link href="/contact">
            <MapPin aria-hidden size={18} />
            Custom order request
          </Link>
          <Link href="/cart">
            <ShoppingBag aria-hidden size={18} />
            Cart
          </Link>
          <Link href="/orders">
            <PackageCheck aria-hidden size={18} />
            Crafting journey
          </Link>
        </aside>
      </div>
    </section>
  );
}
