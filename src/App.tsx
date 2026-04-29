import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import LoginPage from "./pages/LoginPage";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardPage from "./pages/DashboardPage";
import FacultyUploadPage from "./pages/FacultyUploadPage";
import AllocationPage from "./pages/AllocationPage";
import ResultsPage from "./pages/ResultsPage";
<<<<<<< HEAD
import DeptBlockRulesPage from "./pages/DeptBlockRulesPage";
import BlockAssignmentPage from "./pages/BlockAssignmentPage";
=======
import DaywiseAllocationPage from "./pages/DaywiseAllocationPage";
>>>>>>> e7a76da5b9db5d346e872ddf8c43fda3a4d537f1
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="faculty-upload" element={<FacultyUploadPage />} />
              <Route path="allocation" element={<AllocationPage />} />
<<<<<<< HEAD
              <Route path="dept-block-rules" element={<DeptBlockRulesPage />} />
              <Route path="block-assignment" element={<BlockAssignmentPage />} />
=======
              <Route path="daywise-allocation" element={<DaywiseAllocationPage />} />
>>>>>>> e7a76da5b9db5d346e872ddf8c43fda3a4d537f1
              <Route path="results" element={<ResultsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
