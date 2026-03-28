import { AppLayout } from "@/components/layout/AppLayout";
import { InviteUserForm } from "@/components/settings/InviteUserForm";

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage your team and preferences</p>
        </div>
        <div className="max-w-lg">
          <InviteUserForm />
        </div>
      </div>
    </AppLayout>
  );
}
