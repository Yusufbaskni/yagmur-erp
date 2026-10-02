import { notFound } from "next/navigation";
import { PageHeader } from "@/components/erp";
import { ProductForm } from "@/components/forms";
import { kurusToInput, milliToInput } from "@/lib/format";
import { updateProductAction } from "@/server/actions";
import { formOptions, getProduct } from "@/server/queries";

export const metadata = { title: "Ürün düzenle" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, opts] = await Promise.all([getProduct(id), formOptions()]);
  if (!product) notFound();
  return (
    <div>
      <PageHeader eyebrow={product.sku} title="Ürünü düzenle" />
      <ProductForm
        action={updateProductAction}
        warehouses={opts.warehouses}
        initial={{
          id: product.id,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          unit: product.unit,
          salePrice: kurusToInput(product.salePrice),
          purchasePrice: kurusToInput(product.purchasePrice),
          vatRate: product.vatRate,
          minStock: milliToInput(product.minStock),
          trackLot: product.trackLot,
          trackSerial: product.trackSerial,
          active: product.active,
        }}
      />
    </div>
  );
}
