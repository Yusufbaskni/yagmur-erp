import type { UserRole } from "@prisma/client";
import { ErpError } from "@/server/errors";

const ALL: UserRole[] = ["ADMIN", "SALES", "PURCHASING", "WAREHOUSE", "ACCOUNTING"];

const matrix: Record<string, UserRole[]> = {
  party: ["ADMIN", "SALES", "PURCHASING", "ACCOUNTING"],
  product: ["ADMIN", "SALES", "PURCHASING", "WAREHOUSE"],
  stock: ["ADMIN", "WAREHOUSE"],
  sales: ["ADMIN", "SALES"],
  purchasing: ["ADMIN", "PURCHASING"],
  finance: ["ADMIN", "ACCOUNTING"],
  manufacturing: ["ADMIN", "WAREHOUSE"],
  hr: ["ADMIN"],
  crm: ["ADMIN", "SALES"],
  settings: ["ADMIN"],
  audit: ["ADMIN", "ACCOUNTING"],
  backup: ["ADMIN"],
  einvoice: ["ADMIN", "ACCOUNTING", "SALES"],
};

export function assertPermission(role: UserRole, area: keyof typeof matrix) {
  const allowed = matrix[area] ?? ALL;
  if (!allowed.includes(role) && role !== "ADMIN") {
    throw new ErpError("Bu işlem için yetkiniz yok.");
  }
}

export function roleLabel(role: UserRole) {
  return (
    {
      ADMIN: "Yönetici",
      SALES: "Satış",
      PURCHASING: "Satın alma",
      WAREHOUSE: "Depo",
      ACCOUNTING: "Muhasebe",
    } as const
  )[role];
}
