import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import NotFound from "@/pages/not-found";

// Import pages
import Dashboard from "@/pages/dashboard";
import JobsPage from "@/pages/jobs/index";
import ClientsPage from "@/pages/clients/index";
import CalendarPage from "@/pages/calendar/index";

const queryClient = new QueryClient();

// Stubs for remaining pages
const EstimatesPage = () => <div className="p-8"><h1 className="text-2xl font-bold">Estimates (Coming soon)</h1></div>;
const MaterialsPage = () => <div className="p-8"><h1 className="text-2xl font-bold">Materials (Coming soon)</h1></div>;
const ReceiptsPage = () => <div className="p-8"><h1 className="text-2xl font-bold">Receipts (Coming soon)</h1></div>;

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/jobs" component={JobsPage} />
        <Route path="/clients" component={ClientsPage} />
        <Route path="/estimates" component={EstimatesPage} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/materials" component={MaterialsPage} />
        <Route path="/receipts" component={ReceiptsPage} />
        
        {/* Detail/New routes would go here */}
        
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
