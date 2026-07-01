"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ColumnDef, DataTable } from "@/components/ui/table";
import {
  createAccountingAssignmentByEmailAction,
  removeAccountingAssignmentAction,
} from "@/lib/accounting/actions";
import type { SerializedAssignment } from "@/lib/accounting/types";
import type { CompanyOption } from "@/lib/admin/selected-company";
import { toastAsync } from "@/lib/toast";

function RemoveAssignmentButton({
  userId,
  userEmail,
  removingUserId,
  onRemove,
}: {
  userId: string;
  userEmail: string;
  removingUserId: string | null;
  onRemove: (userId: string, userEmail: string) => Promise<void>;
}) {
  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      disabled={removingUserId === userId}
      onClick={() => void onRemove(userId, userEmail)}
    >
      {removingUserId === userId ? "Removing…" : "Remove"}
    </Button>
  );
}

type AccountingAdminsManagerProps = {
  assignments: SerializedAssignment[];
  companies: CompanyOption[];
};

export function AccountingAdminsManager({ assignments, companies }: AccountingAdminsManagerProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const companyItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const company of companies) {
      items[company.id] = company.name;
    }
    return items;
  }, [companies]);

  const handleRemove = useCallback(
    async (userId: string, userEmail: string) => {
      if (!window.confirm(`Remove accounting admin access for ${userEmail}?`)) {
        return;
      }

      setRemovingUserId(userId);
      try {
        await toastAsync(
          removeAccountingAssignmentAction(userId).then((result) => {
            if (!result.ok) {
              throw new Error(result.error);
            }
          }),
          {
            loading: "Removing assignment…",
            success: "Assignment removed.",
          },
        );
        router.refresh();
      } catch {
        // toastAsync already surfaced the error toast
      } finally {
        setRemovingUserId(null);
      }
    },
    [router],
  );

  const columns = useMemo<ColumnDef<SerializedAssignment>[]>(
    () => [
      {
        id: "user",
        header: "User",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.userName ?? row.original.userEmail}</p>
            <p className="text-muted-foreground text-xs">{row.original.userEmail}</p>
          </div>
        ),
      },
      {
        accessorKey: "companyName",
        header: "Company",
      },
      {
        id: "actions",
        header: "",
        meta: { align: "right" },
        cell: ({ row }) => (
          <RemoveAssignmentButton
            userId={row.original.userId}
            userEmail={row.original.userEmail}
            removingUserId={removingUserId}
            onRemove={handleRemove}
          />
        ),
      },
    ],
    [removingUserId, handleRemove],
  );

  async function handleAssign(event: React.FormEvent) {
    event.preventDefault();
    if (!companyId) {
      return;
    }

    setSaving(true);
    try {
      await toastAsync(
        createAccountingAssignmentByEmailAction({ email, companyId }).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
        }),
        {
          loading: "Assigning accounting admin…",
          success: "Accounting admin assigned.",
        },
      );
      setEmail("");
      router.refresh();
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleAssign}
        className="grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="assign-email">User email</Label>
          <Input
            id="assign-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="user@company.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Company</Label>
          <Select
            items={companyItems}
            value={companyId}
            onValueChange={(value) => setCompanyId(value as string)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={saving || companies.length === 0}>
          {saving ? "Assigning…" : "Assign"}
        </Button>
      </form>

      <DataTable
        columns={columns}
        data={assignments}
        emptyMessage="No accounting admins assigned yet."
      />
    </div>
  );
}
