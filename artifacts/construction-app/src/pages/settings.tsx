import { useState, useRef } from "react";
import { useGetCompany, useUpdateCompany, getGetCompanyQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@workspace/object-storage-web";
import { AlertCircle, Save, Building, Phone, MapPin, Mail, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function SettingsPage() {
  const { data: company, isLoading } = useGetCompany();
  const updateCompany = useUpdateCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const lastObjectPathRef = useRef<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
  });

  // Sync form data once company loads
  useState(() => {
    if (company) {
      setFormData({
        name: company.name || "",
        phone: company.phone || "",
        email: company.email || "",
        website: company.website || "",
        address: company.address || "",
        city: company.city || "",
        state: company.state || "",
        zipCode: company.zipCode || "",
      });
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompany.mutate(
      { data: formData },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetCompanyQueryKey(), data);
          toast({ title: "Settings saved", description: "Company profile has been updated." });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update settings.", variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) return <div className="p-6">Loading settings...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Company Settings</h1>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4 flex gap-3 text-amber-800 dark:text-amber-200">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold mb-1">Email & SMS not configured</h3>
          <p className="text-sm">You won't be able to send estimates or invoices directly to clients until you configure an email or SMS provider. For now, you can download them as PDFs.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Logo</CardTitle>
              <CardDescription>Displayed on estimates and invoices</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="h-32 w-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted overflow-hidden">
                {company?.logoUrl ? (
                  <img src={company.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Building className="h-12 w-12 text-muted-foreground opacity-20" />
                )}
              </div>
              <ObjectUploader
                onGetUploadParameters={async (file) => {
                  const res = await fetch("/api/storage/uploads/request-url", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
                  });
                  const { uploadURL, objectPath } = await res.json();
                  lastObjectPathRef.current = objectPath;
                  return { method: "PUT", url: uploadURL, headers: { "Content-Type": file.type } };
                }}
                onComplete={async (result) => {
                  if (result.successful && result.successful.length > 0) {
                    const objectPath = lastObjectPathRef.current;
                    if (objectPath) {
                      updateCompany.mutate(
                        { data: { logoUrl: `/api/storage${objectPath}` } },
                        {
                          onSuccess: (data) => {
                            queryClient.setQueryData(getGetCompanyQueryKey(), data);
                            toast({ title: "Logo updated" });
                          }
                        }
                      );
                    }
                  }
                }}
                buttonClassName="bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-4 py-2 rounded-md text-sm font-medium w-full"
              >
                Upload Logo
              </ObjectUploader>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle>Company Profile</CardTitle>
                <CardDescription>Update your business information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name</Label>
                  <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
                </div>
                
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} className="pl-9" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} className="pl-9" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="address" name="address" value={formData.address} onChange={handleChange} className="pl-9" />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
                  <div className="col-span-2 sm:col-span-3 space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" name="city" value={formData.city} onChange={handleChange} />
                  </div>
                  <div className="col-span-1 space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input id="state" name="state" value={formData.state} onChange={handleChange} />
                  </div>
                  <div className="col-span-1 sm:col-span-2 space-y-2">
                    <Label htmlFor="zipCode">Zip Code</Label>
                    <Input id="zipCode" name="zipCode" value={formData.zipCode} onChange={handleChange} />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={updateCompany.isPending}>
                    {updateCompany.isPending ? "Saving..." : "Save Changes"}
                    <Save className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      </div>
    </div>
  );
}
