import { PageHeader } from "@/components/erp";
import { MovementForm } from "@/components/forms";
import { createMovementAction } from "@/server/actions";
import { formOptions } from "@/server/queries";

export const metadata = { title: "Stok hareketi" };

export default async function NewMovementPage() {
  const { products, warehouses } = await formOptions();
  return (
    <div>
      <PageHeader
        title="Stok hareketi"
        description="Çıkış depodaki kullanılabilir stoğu aşamaz."
      />
      <MovementForm action={createMovementAction} products={products} warehouses={warehouses} />
    </div>
  );
}
