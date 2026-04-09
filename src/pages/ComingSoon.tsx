import AppLayout from "@/components/layout/AppLayout";
import { Construction } from "lucide-react";

interface ComingSoonProps {
  title: string;
}

const ComingSoon = ({ title }: ComingSoonProps) => {
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <Construction className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">{title}</h1>
        <p className="text-muted-foreground text-sm max-w-md">
          This module is currently under development. Check back soon for updates.
        </p>
      </div>
    </AppLayout>
  );
};

export default ComingSoon;
