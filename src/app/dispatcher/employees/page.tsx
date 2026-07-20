import { Topbar } from "@/components/dispatcher/Topbar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/StatusBadge";
import { Input } from "@/components/ui/Field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { getUsers } from "@/lib/data";

const roleLabel = { driver: "Driver", dispatcher: "Dispatcher", office: "Office" };

// Screen 10 — Employees.
export default function EmployeesPage() {
  const employees = getUsers();

  return (
    <>
      <Topbar
        title="Employees"
        action={
          <Button>
            <Icon name="plus" width={18} height={18} />
            Add Employee
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <Card>
          <div className="p-5 border-b border-gray-100">
            <div className="relative max-w-md">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                width={18}
                height={18}
              />
              <Input placeholder="Search employees..." className="pl-10" />
            </div>
          </div>

          <Table>
            <THead>
              <TH>Employee</TH>
              <TH>Role</TH>
              <TH>Phone</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </THead>
            <TBody>
              {employees.map((e) => (
                <TR key={e.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar initials={e.initials} size="sm" />
                      <span className="font-medium text-gray-900">
                        {e.fullName}
                      </span>
                    </div>
                  </TD>
                  <TD>{roleLabel[e.role]}</TD>
                  <TD>{e.phone}</TD>
                  <TD>
                    <Badge
                      tone={e.status === "active" ? "green" : "gray"}
                      label={e.status === "active" ? "Active" : "Inactive"}
                    />
                  </TD>
                  <TD className="text-right">
                    <button className="text-gray-400 hover:text-brand-500 inline-flex">
                      <Icon name="edit" width={18} height={18} />
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="px-5 py-3 text-sm text-gray-500 border-t border-gray-100">
            Showing 1 to {employees.length} of 18 employees
          </div>
        </Card>
      </div>
    </>
  );
}
