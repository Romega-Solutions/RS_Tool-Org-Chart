"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Building2 } from "lucide-react";
import { PeopleTable } from "@/components/admin/people-table";
import { DepartmentList } from "@/components/admin/department-list";
import { ImportDialog } from "@/components/admin/import-dialog";

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "Merriweather, serif" }}>
            Team Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage people and departments in your organization.
          </p>
        </div>
        <ImportDialog />
      </div>

      <Tabs defaultValue="people" className="w-full">
        <TabsList className="w-fit">
          <TabsTrigger value="people" className="cursor-pointer transition-all duration-200 gap-2">
            <Users className="w-4 h-4" />
            People
          </TabsTrigger>
          <TabsTrigger value="departments" className="cursor-pointer transition-all duration-200 gap-2">
            <Building2 className="w-4 h-4" />
            Departments
          </TabsTrigger>
        </TabsList>
        <TabsContent value="people" className="mt-4">
          <PeopleTable />
        </TabsContent>
        <TabsContent value="departments" className="mt-4">
          <DepartmentList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
