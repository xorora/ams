"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SerializedEmployee } from "@/lib/admin/serialize";

type EmployeeTableProps = {
  employees: SerializedEmployee[];
  loading: boolean;
  onEdit: (employee: SerializedEmployee) => void;
  onDeactivate: (id: string, name: string) => void;
  onReactivate: (id: string) => void;
};

export function EmployeeTable({
  employees,
  loading,
  onEdit,
  onDeactivate,
  onReactivate,
}: EmployeeTableProps) {
  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          ) : employees.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                No employees found.
              </TableCell>
            </TableRow>
          ) : (
            employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell className="font-mono text-xs">{employee.employeeCode}</TableCell>
                <TableCell>{employee.fullName}</TableCell>
                <TableCell>{employee.email}</TableCell>
                <TableCell>{employee.department ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={employee.isActive ? "default" : "secondary"}>
                    {employee.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(employee)}
                    >
                      Edit
                    </Button>
                    {employee.isActive ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => onDeactivate(employee.id, employee.fullName)}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => onReactivate(employee.id)}
                      >
                        Reactivate
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
