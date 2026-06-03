import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { LocationGroupsSettings } from "@/components/settings/LocationGroupsSettings";
import { CommunalGroupsSettings } from "@/components/settings/CommunalGroupsSettings";
import { RequestsSettings } from "@/components/settings/RequestsSettings";
import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";
import { CleanersSettings } from "@/components/settings/CleanersSettings";
import { FinanceSettings } from "@/components/settings/FinanceSettings";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { InviteUserForm } from "@/components/settings/InviteUserForm";
import CleanReset from "@/pages/CleanReset";
import { useAuth } from "@/contexts/AuthContext";
import { Settings, Plug, SprayCan, PoundSterling, User, RotateCcw } from "lucide-react";

export default function SettingsPage() {
  const { role } = useAuth();
  const canCleanReset = role === "super" || role === "senior" || role === "admin";
  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage your workspace, integrations, and team</p>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="bg-secondary/50 border border-border/30 h-auto flex-wrap">
            <TabsTrigger value="general" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Settings className="h-3.5 w-3.5" />General
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Plug className="h-3.5 w-3.5" />Integrations
            </TabsTrigger>
            <TabsTrigger value="cleaners" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <SprayCan className="h-3.5 w-3.5" />Cleaners
            </TabsTrigger>
            <TabsTrigger value="finance" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <PoundSterling className="h-3.5 w-3.5" />Finance
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <User className="h-3.5 w-3.5" />Account
            </TabsTrigger>
            {canCleanReset && (
              <TabsTrigger value="clean-reset" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <RotateCcw className="h-3.5 w-3.5" />Clean Reset
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="general">
            <div className="space-y-6">
              <GeneralSettings />
              <div className="max-w-xl">
                <LocationGroupsSettings />
              </div>
              <div className="max-w-xl">
                <CommunalGroupsSettings />
              </div>
              <div className="max-w-xl">
                <RequestsSettings />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="integrations"><IntegrationsSettings /></TabsContent>
          <TabsContent value="cleaners"><CleanersSettings /></TabsContent>
          <TabsContent value="finance"><FinanceSettings /></TabsContent>
          <TabsContent value="account">
            <div className="space-y-6">
              <AccountSettings />
              <div className="max-w-xl">
                <InviteUserForm />
              </div>
            </div>
          </TabsContent>
          {canCleanReset && (
            <TabsContent value="clean-reset"><CleanReset embedded /></TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
