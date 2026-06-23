import React from "react";
import { useListClients } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";
import { Search, Plus, Phone, Mail, MapPin } from "lucide-react";
import { format } from "date-fns";

export default function ClientsPage() {
  const [search, setSearch] = React.useState("");
  const { data: clients, isLoading } = useListClients({ search });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Clients</h1>
          <p className="text-slate-500 mt-1">Directory of property owners and managers</p>
        </div>
        <Button asChild>
          <Link href="/clients/new"><Plus className="mr-2 h-4 w-4" /> New Client</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search by name, email, or phone..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead>Client</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-5 w-32 bg-slate-100 animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-5 w-40 bg-slate-100 animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-5 w-32 bg-slate-100 animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-5 w-24 bg-slate-100 animate-pulse rounded"></div></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : clients?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    No clients found matching your search
                  </TableCell>
                </TableRow>
              ) : (
                clients?.map(client => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="font-medium text-slate-900 group-hover:text-primary transition-colors">
                        <Link href={`/clients/${client.id}`}>{client.name}</Link>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm text-slate-600">
                        {client.phone && <div className="flex items-center"><Phone className="h-3 w-3 mr-1.5 text-slate-400" /> {client.phone}</div>}
                        {client.email && <div className="flex items-center"><Mail className="h-3 w-3 mr-1.5 text-slate-400" /> {client.email}</div>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-600 flex items-start">
                        <MapPin className="h-3 w-3 mr-1.5 mt-0.5 text-slate-400 shrink-0" />
                        <div>
                          {client.address ? (
                            <>
                              <div>{client.address}</div>
                              <div>{client.city}{client.state ? `, ${client.state}` : ''} {client.zipCode}</div>
                            </>
                          ) : (
                            <span className="text-slate-400 italic">No address</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {format(new Date(client.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/clients/${client.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
