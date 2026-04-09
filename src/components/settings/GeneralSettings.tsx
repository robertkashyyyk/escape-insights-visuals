import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function GeneralSettings() {
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState("Escape Ordinary");
  const [timezone, setTimezone] = useState("Europe/London");
  const [currency, setCurrency] = useState("GBP");
  const [reportDay, setReportDay] = useState("15");

  const handleSave = () => {
    toast({ title: "Settings saved", description: "General settings updated successfully." });
  };

  return (
    <div className="space-y-6 max-w-xl">
      <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            <Building2 className="h-4 w-4 text-primary" />
            Company
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Company Name</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="bg-secondary/50 border-border/40" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="bg-secondary/50 border-border/40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Europe/London">Europe / London</SelectItem>
                  <SelectItem value="Europe/Dublin">Europe / Dublin</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="bg-secondary/50 border-border/40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GBP">£ GBP</SelectItem>
                  <SelectItem value="EUR">€ EUR</SelectItem>
                  <SelectItem value="USD">$ USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Monthly Report Generation Day</Label>
            <Input type="number" min={1} max={28} value={reportDay} onChange={(e) => setReportDay(e.target.value)} className="bg-secondary/50 border-border/40 w-24" />
            <p className="text-xs text-muted-foreground">Day of month reports are auto-generated (1–28)</p>
          </div>
          <Button onClick={handleSave} size="sm">Save Changes</Button>
        </CardContent>
      </Card>
    </div>
  );
}
