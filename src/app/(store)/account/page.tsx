import Link from "next/link";
import { LogOut, MapPin, PackageCheck, ShoppingBag, UserRound } from "lucide-react";
import { updateProfileAction } from "@/app/actions/account";
import { logoutAction } from "@/app/actions/auth";
import { AccountNav } from "@/components/account-nav";
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

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const session = await requireUser();
  const params = await searchParams;
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
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    }),
  ]);
  const profileMessage =
    params.profile === "email-taken"
      ? "That email is already connected to another account."
      : params.profile === "invalid"
        ? "Please check the profile details and try again."
        : null;

  return (
    <section className="account-page">
      <div className="section-heading heading-row">
        <div>
          <span className="panel-label">Account</span>
          <h1>Hello, {user?.name ?? session.name}</h1>
          <p>Your profile, saved delivery addresses, and recent handcrafted orders live here.</p>
        </div>
        <form action={logoutAction}>
          <button className="account-logout-button" type="submit">
            <LogOut aria-hidden size={15} /> Sign out
          </button>
        </form>
      </div>

      <AccountNav active="Account" />

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
            <form className="account-form profile-edit-form" action={updateProfileAction}>
              <label>
                <span>Name</span>
                <input name="name" defaultValue={user?.name ?? session.name} required />
              </label>
              <label>
                <span>Email</span>
                <input name="email" type="email" defaultValue={user?.email ?? session.email} required />
              </label>
              <label>
                <span>Phone</span>
                <input name="phone" defaultValue={user?.phone ?? ""} placeholder="Phone number" />
              </label>
              {profileMessage ? <p className="form-message">{profileMessage}</p> : null}
              <button className="secondary-button" type="submit">Save profile</button>
            </form>
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
                      <strong>
                        {address.label}
                        {address.isDefault ? <span className="address-badge">Default</span> : null}
                      </strong>
                      <p>{formatAddress(address)}</p>
                    </div>
                  </article>
                ))}
                <Link className="secondary-button" href="/account/addresses">Manage addresses</Link>
              </div>
            ) : (
              <div className="soft-empty">
                <p>No saved addresses yet. Your next checkout can save one for faster future orders.</p>
                <Link className="secondary-button" href="/account/addresses">
                  Add address
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
          <Link href="/account/addresses">
            <MapPin aria-hidden size={18} />
            Saved addresses
          </Link>
          <Link href="/account/reviews">
            <UserRound aria-hidden size={18} />
            My reviews
          </Link>
        </aside>
      </div>
    </section>
  );
}
