import { PageHeader } from "@/components/erp";
import { ProductForm } from "@/components/forms";
import { createProductAction } from "@/server/actions";
import { formOptions } from "@/server/queries";

export const metadata = { title: "Yeni ürün" };

export default async function NewProductPage() {
  const { warehouses } = await formOptions();
  return (
    <div>
      <PageHeader
        title="Yeni ürün"
        description="Fiyatlar KDV hariçtir. Barkod ve lot/seri takibi opsiyoneldir."
      />
      <ProductForm action={createProductAction} warehouses={warehouses} />
    </div>
  );
}
