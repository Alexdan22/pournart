import Link from "next/link";
import { Check, MapPin, Plus, Star, Trash2 } from "lucide-react";
import {
  deleteAddressAction,
  saveAddressAction,
  setDefaultAddressAction,
} from "@/app/actions/account";
import { AccountNav } from "@/components/account-nav";
import { prisma } from "@/lib/db";
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

function AddressFields({
  address,
  formId,
}: {
  formId?: string;
  address?: {
    label: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    pincode: string;
    country: string;
    isDefault: boolean;
  };
}) {
  return (
    <div className="account-form-grid">
      <label>
        <span>Label</span>
        <input form={formId} name="label" defaultValue={address?.label ?? "Home"} required />
      </label>
      <label>
        <span>Address line 1</span>
        <input form={formId} name="line1" defaultValue={address?.line1 ?? ""} required />
      </label>
      <label>
        <span>Address line 2</span>
        <input form={formId} name="line2" defaultValue={address?.line2 ?? ""} />
      </label>
      <label>
        <span>City</span>
        <input form={formId} name="city" defaultValue={address?.city ?? ""} required />
      </label>
      <label>
        <span>State</span>
        <input form={formId} name="state" defaultValue={address?.state ?? ""} required />
      </label>
      <label>
        <span>Pincode</span>
        <input form={formId} name="pincode" defaultValue={address?.pincode ?? ""} required />
      </label>
      <label>
        <span>Country</span>
        <input form={formId} name="country" defaultValue={address?.country ?? "India"} required />
      </label>
      <label className="account-checkbox-row">
        <input form={formId} name="isDefault" type="checkbox" defaultChecked={address?.isDefault ?? false} />
        <span>Use as default delivery address</span>
      </label>
    </div>
  );
}

export default async function AccountAddressesPage({
  searchParams,
}: {
  searchParams: Promise<{ address?: string }>;
}) {
  const session = await requireUser();
  const params = await searchParams;
  const addresses = await prisma.address.findMany({
    where: { userId: session.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  const message = params.address === "invalid" ? "Please check the address details and try again." : null;

  return (
    <section className="account-page">
      <div className="section-heading heading-row">
        <div>
          <span className="panel-label">Addresses</span>
          <h1>Saved delivery addresses.</h1>
          <p>Keep the delivery details you use most often ready for checkout.</p>
        </div>
        <Link className="secondary-button" href="/checkout">Go to checkout</Link>
      </div>

      <AccountNav active="Addresses" />

      <div className="account-layout">
        <div className="account-main">
          <section className="account-panel">
            <div className="account-panel-heading">
              <Plus aria-hidden size={22} />
              <div>
                <span className="panel-label">New address</span>
                <h2>Add a saved address</h2>
              </div>
            </div>
            <form className="account-form" action={saveAddressAction}>
              <AddressFields />
              {message ? <p className="form-message">{message}</p> : null}
              <button className="primary-button" type="submit">Save address</button>
            </form>
          </section>

          <section className="account-panel">
            <div className="account-panel-heading">
              <MapPin aria-hidden size={22} />
              <div>
                <span className="panel-label">Address book</span>
                <h2>{addresses.length ? "Manage addresses" : "No saved addresses yet"}</h2>
              </div>
            </div>
            {addresses.length > 0 ? (
              <div className="address-card-list">
                {addresses.map((address) => {
                  const formId = `address-${address.id}`;

                  return (
                    <article className="saved-address-card editable-address-card" key={address.id}>
                      <div>
                        <strong>
                          {address.label}
                          {address.isDefault ? <span className="address-badge">Default</span> : null}
                        </strong>
                        <p>{formatAddress(address)}</p>
                      </div>
                      <div className="address-action-row">
                        {!address.isDefault ? (
                          <form action={setDefaultAddressAction}>
                            <input type="hidden" name="addressId" value={address.id} />
                            <button className="icon-link" type="submit" aria-label={`Set ${address.label} as default`}>
                              <Star aria-hidden size={17} />
                            </button>
                          </form>
                        ) : null}
                        <form action={deleteAddressAction}>
                          <input type="hidden" name="addressId" value={address.id} />
                          <button className="icon-link" type="submit" aria-label={`Delete ${address.label} address`}>
                            <Trash2 aria-hidden size={17} />
                          </button>
                        </form>
                      </div>
                      <details className="account-edit-details">
                        <summary>Edit address</summary>
                        <form className="account-form" id={formId} action={saveAddressAction}>
                          <input type="hidden" name="addressId" value={address.id} />
                          <AddressFields address={address} formId={formId} />
                          <button className="secondary-button" type="submit">
                            <Check aria-hidden size={16} /> Save changes
                          </button>
                        </form>
                      </details>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="soft-empty">
                <p>Add one delivery address here, then checkout can prefill it for future handmade orders.</p>
              </div>
            )}
          </section>
        </div>

        <aside className="account-panel account-shortcuts">
          <span className="panel-label">Address tips</span>
          <h2>Default address</h2>
          <p className="summary-note">Your default address appears first at checkout. You can still pick another saved address while placing an order.</p>
          <Link href="/account">
            <MapPin aria-hidden size={18} />
            Back to account
          </Link>
        </aside>
      </div>
    </section>
  );
}
