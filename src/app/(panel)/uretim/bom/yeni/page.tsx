import { PageHeader } from "@/components/erp";
import { BomCreateForm } from "@/components/bom-form";
import { formOptions } from "@/server/queries";

export const metadata = { title: "Yeni BOM" };

export default async function NewBomPage() {
  const { products } = await formOptions();
  return (
    <div>
      <PageHeader title="Yeni ürün ağacı" description="Mamul ve bileşen miktarlarını tanımlayın." />
      <BomCreateForm products={products} />
    </div>
  );
}
