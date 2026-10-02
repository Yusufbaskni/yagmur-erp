import { PageHeader } from "@/components/erp";
import { WorkOrderCreateForm } from "@/components/workorder-form";
import { formOptions, listBoms } from "@/server/queries";

export const metadata = { title: "Yeni iş emri" };

export default async function NewWorkOrderPage() {
  const [boms, opts] = await Promise.all([listBoms(), formOptions()]);
  return (
    <div>
      <PageHeader title="Yeni iş emri" description="BOM seçerek üretim emri açın." />
      <WorkOrderCreateForm boms={boms} warehouses={opts.warehouses} />
    </div>
  );
}
