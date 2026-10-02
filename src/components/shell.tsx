"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeftRight,
  Banknote,
  Boxes,
  Building2,
  ClipboardCheck,
  Factory,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Scale,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  UserRound,
  Wallet,
  Contact,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { logoutAction, switchCompanyAction } from "@/server/actions";
import { cn } from "cn";

const groups = [
  {
    label: "Genel",
    items: [
      { href: "/", label: "Panel", icon: LayoutDashboard, exact: true },
      { href: "/cariler", label: "Cariler", icon: Users },
      { href: "/urunler", label: "Ürünler", icon: Package },
    ],
  },
  {
    label: "Ticaret",
    items: [
      { href: "/satis", label: "Satış siparişleri", icon: ShoppingCart },
      { href: "/satis/faturalar", label: "Satış faturaları", icon: FileText },
      { href: "/satin-alma", label: "Satın alma", icon: Truck },
      { href: "/satin-alma/mal-kabul", label: "Mal kabul", icon: ClipboardCheck },
      { href: "/satin-alma/faturalar", label: "Alış faturaları", icon: FileText },
      { href: "/irsaliye", label: "İrsaliyeler", icon: Truck },
      { href: "/e-fatura", label: "e-Fatura", icon: FileText },
    ],
  },
  {
    label: "Stok",
    items: [
      { href: "/stok", label: "Stok hareketleri", icon: ArrowLeftRight },
      { href: "/stok/depolar", label: "Depolar", icon: Boxes },
      { href: "/stok/transfer", label: "Transferler", icon: ArrowLeftRight },
    ],
  },
  {
    label: "Finans",
    items: [
      { href: "/tahsilat", label: "Tahsilat", icon: Banknote },
      { href: "/odeme", label: "Ödeme", icon: Wallet },
      { href: "/finans", label: "Finans özeti", icon: Scale },
      { href: "/finans/kasa-banka", label: "Kasa / banka", icon: Wallet },
      { href: "/cek-senet", label: "Çek-senet", icon: Banknote },
      { href: "/finans/kdv", label: "KDV raporu", icon: Scale },
      { href: "/finans/yevmiye", label: "Yevmiye", icon: FileText },
    ],
  },
  {
    label: "Üretim",
    items: [
      { href: "/uretim/bom", label: "Ürün ağacı", icon: Factory },
      { href: "/uretim/is-emri", label: "İş emirleri", icon: Factory },
    ],
  },
  {
    label: "İK",
    items: [
      { href: "/ik/calisanlar", label: "Çalışanlar", icon: UserRound },
      { href: "/ik/izinler", label: "İzinler", icon: UserRound },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/crm/leads", label: "Leadler", icon: Contact },
      { href: "/crm/firsatlar", label: "Fırsatlar", icon: Contact },
    ],
  },
  {
    label: "Ayarlar",
    items: [
      { href: "/ayarlar", label: "Ayarlar", icon: Settings },
      { href: "/ayarlar/denetim", label: "Denetim kaydı", icon: FileText },
    ],
  },
];

function active(pathname: string, href: string, exact?: boolean) {
  if (exact || href === "/") return pathname === href;
  if (href === "/satis") {
    return pathname === "/satis" || /^\/satis\/(?!faturalar).+/.test(pathname);
  }
  if (href === "/satin-alma") {
    return (
      pathname === "/satin-alma" ||
      /^\/satin-alma\/(?!mal-kabul|faturalar).+/.test(pathname)
    );
  }
  if (href === "/stok") {
    return pathname === "/stok" || pathname === "/stok/yeni";
  }
  if (href === "/finans") {
    return pathname === "/finans";
  }
  if (href === "/uretim/bom") {
    return pathname === "/uretim/bom" || pathname.startsWith("/uretim/bom/");
  }
  if (href === "/uretim/is-emri") {
    return pathname.startsWith("/uretim/is-emri");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Navigation() {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-2 pb-1 text-[10px] font-semibold tracking-[0.16em] text-sidebar-foreground/50 uppercase">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const on = active(pathname, item.href, item.exact);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    on
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Brand({
  companyName,
  companies,
  activeCompanyId,
}: {
  companyName: string;
  companies: { id: string; name: string }[];
  activeCompanyId: string;
}) {
  return (
    <div className="border-b border-sidebar-border px-4 py-4">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-sidebar-primary uppercase">
        ERP
      </p>
      <p className="text-lg leading-tight font-semibold">Yağmur</p>
      <p className="text-xs text-sidebar-foreground/70">{companyName}</p>
      {companies.length > 1 ? (
        <form action={switchCompanyAction} className="mt-2">
          <label className="flex items-center gap-1 text-[10px] text-sidebar-foreground/50">
            <Building2 className="size-3" />
            Şirket
          </label>
          <select
            name="companyId"
            defaultValue={activeCompanyId}
            className="mt-1 w-full rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs"
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </form>
      ) : null}
    </div>
  );
}

function UserBox({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: string;
}) {
  return (
    <div className="border-t border-sidebar-border p-3">
      <p className="truncate text-sm font-medium">{name}</p>
      <p className="truncate text-xs text-sidebar-foreground/60">{email}</p>
      <p className="truncate text-[10px] text-sidebar-foreground/50">{role}</p>
      <form action={logoutAction} className="mt-2">
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="w-full justify-start px-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut />
          Çıkış
        </Button>
      </form>
    </div>
  );
}

export function AppShell({
  user,
  company,
  companies,
  roleLabel,
  children,
}: {
  user: { name: string; email: string };
  company: { id: string; name: string; shortName: string };
  companies: { id: string; name: string }[];
  roleLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menu, setMenu] = useState({ path: pathname, open: false });
  const open = menu.open && menu.path === pathname;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <Brand
          companyName={company.name}
          companies={companies}
          activeCompanyId={company.id}
        />
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <Navigation />
        </nav>
        <UserBox name={user.name} email={user.email} role={roleLabel} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b bg-card px-3 py-2 md:hidden">
          <Sheet
            open={open}
            onOpenChange={(next) => setMenu({ path: pathname, open: next })}
          >
            <SheetTrigger
              render={<Button variant="outline" size="icon" aria-label="Menü" />}
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
              <SheetHeader className="sr-only">
                <SheetTitle>Menü</SheetTitle>
              </SheetHeader>
              <Brand
                companyName={company.name}
                companies={companies}
                activeCompanyId={company.id}
              />
              <div className="px-2 py-3">
                <Navigation />
              </div>
            </SheetContent>
          </Sheet>
          <div>
            <p className="text-sm font-semibold">{company.shortName}</p>
            <p className="text-xs text-muted-foreground">{user.name}</p>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">{children}</main>
      </div>
    </div>
  );
}
