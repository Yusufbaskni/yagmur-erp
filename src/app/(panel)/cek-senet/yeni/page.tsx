import { PageHeader } from "@/components/erp";
import { CheckCreateForm } from "@/components/check-form";
import { formOptions } from "@/server/queries";

export const metadata = { title: "Yeni çek/senet" };

export default async function NewCheckPage() {
  const { customers, suppliers, moneyAccounts } = await formOptions();
  return (
    <div>
      <PageHeader title="Yeni çek/senet" description="Portföye çek veya senet ekleyin." />
      <CheckCreateForm
        parties={[...customers, ...suppliers]}
        moneyAccounts={moneyAccounts}
      />
    </div>
  );
}
