import { OwnerLayout } from "@/components/layout/OwnerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function OwnerStatements() {
  const currentMonth = new Date().toLocaleDateString("en-GB", { month: "long" });

  return (
    <OwnerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">
            My Statements
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Monthly payout summaries and invoices</p>
        </div>

        <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-12 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <FileText className="h-8 w-8 text-primary/60" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-display font-semibold text-foreground">
                Statements coming soon
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Monthly statements will appear here. Your first statement will be available at the end of {currentMonth}.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </OwnerLayout>
  );
}
