import Link from "next/link";
import { Heart, Home, MapPin, PackageCheck, Star } from "lucide-react";

const accountNavItems = [
  { href: "/account", label: "Account", icon: Home },
  { href: "/orders", label: "Orders", icon: PackageCheck },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/reviews", label: "Reviews", icon: Star },
] as const;

export function AccountNav({ active }: { active: (typeof accountNavItems)[number]["label"] }) {
  return (
    <nav className="account-nav" aria-label="Account navigation">
      {accountNavItems.map((item) => {
        const Icon = item.icon;

        return (
          <Link className={active === item.label ? "active" : ""} href={item.href} key={item.href}>
            <Icon aria-hidden size={17} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
