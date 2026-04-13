"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PersonForm } from "@/components/admin/person-form";
import { Pencil, Trash2, Plus, ToggleLeft, ToggleRight, Search } from "lucide-react";
import type { Person } from "@/types";

interface PersonRow extends Person {
  departmentName: string | null;
  departmentColor: string | null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function PeopleTable() {
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchPeople = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/people?includeInactive=true");
      const data = await res.json();
      setPeople(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const filtered = people.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q) ||
      (p.departmentName && p.departmentName.toLowerCase().includes(q))
    );
  });

  async function handleToggle(id: number) {
    await fetch(`/api/people/${id}/toggle`, { method: "PATCH" });
    fetchPeople();
  }

  async function handleDelete(person: PersonRow) {
    if (!confirm(`Delete "${person.name}"? This action cannot be undone.`)) return;
    await fetch(`/api/people/${person.id}`, { method: "DELETE" });
    fetchPeople();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">People</h1>
          <p className="text-sm text-muted-foreground">
            Manage the people in your org chart
          </p>
        </div>
        <PersonForm
          onSave={fetchPeople}
          trigger={
            <Button className="cursor-pointer transition-all duration-200">
              <Plus className="size-4" />
              Add Person
            </Button>
          }
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, title, or department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {search ? "No people match your search." : "No people yet. Add one to get started."}
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Person</th>
                <th className="px-3 py-2 text-left font-medium">Title</th>
                <th className="px-3 py-2 text-left font-medium">Department</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((person) => (
                <tr
                  key={person.id}
                  className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-all duration-200"
                >
                  {/* Person */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar size="default">
                        {person.photoUrl && (
                          <AvatarImage src={person.photoUrl} alt={person.name} />
                        )}
                        <AvatarFallback>{getInitials(person.name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{person.name}</span>
                    </div>
                  </td>

                  {/* Title */}
                  <td className="px-3 py-2 text-muted-foreground">{person.title}</td>

                  {/* Department */}
                  <td className="px-3 py-2">
                    {person.departmentName ? (
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: person.departmentColor || undefined,
                          color: person.departmentColor || undefined,
                        }}
                      >
                        <span
                          className="mr-1 inline-block size-2 rounded-full"
                          style={{
                            backgroundColor: person.departmentColor || "#888",
                          }}
                        />
                        {person.departmentName}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2">
                    <Badge variant={person.isActive ? "default" : "secondary"}>
                      {person.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={person.isActive ? "Deactivate" : "Activate"}
                        onClick={() => handleToggle(person.id)}
                        className="cursor-pointer transition-all duration-200"
                      >
                        {person.isActive ? (
                          <ToggleRight className="size-4 text-green-600" />
                        ) : (
                          <ToggleLeft className="size-4 text-muted-foreground" />
                        )}
                      </Button>
                      <PersonForm
                        person={person}
                        onSave={fetchPeople}
                        trigger={
                          <Button variant="ghost" size="icon-sm" title="Edit" className="cursor-pointer transition-all duration-200">
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Delete"
                        onClick={() => handleDelete(person)}
                        className="cursor-pointer hover:bg-destructive/10 transition-all duration-200"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Count footer */}
      {!loading && (
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {people.length} people
        </p>
      )}
    </div>
  );
}
