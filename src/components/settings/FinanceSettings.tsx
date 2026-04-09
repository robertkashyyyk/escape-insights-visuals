import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PoundSterling } from "lucide-react";

export function FinanceSettings() {
  const { toast } = useToast();
  const [revenueMethod, setRevenueMethod] = useState("check-in");
  const [invoiceMode, setInvoiceMode] = useState("manual");

  const handleSave = () => {
    toast({ title: "Finance settings saved" });
  };

  return (
    <div className="space-y-6 max-w-xl">
      <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            <PoundSterling className="h-4 w-4 text-primary" />
            Revenue Recognition
          </CardTitle>
          <CardDescription>How revenue is attributed across calendar months.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Method</Label>
            <Select value={revenueMethod} onValueChange={setRevenueMethod}>
              <SelectTrigger className="bg-secondary/50 border-border/40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="check-in">Check-in date (full amount on arrival)</SelectItem>
                <SelectItem value="calendar-split">Calendar day split (pro-rated nightly)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Management Invoices</CardTitle>
          <CardDescription>How owner management invoices are generated.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Invoice Generation</Label>
            <Select value={invoiceMode} onValueChange={setInvoiceMode}>
              <SelectTrigger className="bg-secondary/50 border-border/40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="auto">Automatic on 1st of month</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} size="sm">Save Finance Settings</Button>
        </CardContent>
      </Card>
    </div>
  );
}
