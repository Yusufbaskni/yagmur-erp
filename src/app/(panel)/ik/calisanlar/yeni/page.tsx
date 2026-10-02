import { PageHeader } from "@/components/erp";
import { EmployeeCreateForm } from "@/components/employee-form";
import { listDepartments } from "@/server/queries";

export const metadata = { title: "Yeni çalışan" };

export default async function NewEmployeePage() {
  const departments = await listDepartments();
  return (
    <div>
      <PageHeader title="Yeni çalışan" />
      <EmployeeCreateForm departments={departments} />
    </div>
  );
}
