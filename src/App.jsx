import { Suspense, lazy } from "react"
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import PublicLayout from "./layouts/PublicLayout"
import DashboardLayout from "./layouts/DashboardLayout"
import { ThemeProvider } from "./context/ThemeContext"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { JobsProvider } from "./context/JobsContext"
import { SavedContractorsProvider } from "./context/SavedContractorsContext"
import { MessagesProvider } from "./context/MessagesContext"
import { ToastProvider } from "./context/ToastContext"
import { ReviewsProvider } from "./context/ReviewsContext"

const Landing = lazy(() => import("./pages/Landing"))
const HowItWorks = lazy(() => import("./pages/HowItWorks"))
const ContractorSignup = lazy(() => import("./pages/ContractorSignup"))
const ContractorsPage = lazy(() => import("./pages/ContractorsPage"))
const Dashboard = lazy(() => import("./pages/Dashboard"))
const ProjectFeed = lazy(() => import("./pages/ProjectFeed"))
const ProjectDetails = lazy(() => import("./pages/ProjectDetails"))
const MessagesPage = lazy(() => import("./pages/MessagesPage"))
const MyProjects = lazy(() => import("./pages/MyProjects"))
const AdminInsuranceReview = lazy(() => import("./pages/AdminInsuranceReview"))
const AdminProSkillset = lazy(() => import("./pages/AdminProSkillset"))
const Login = lazy(() => import("./pages/Login"))
const Signup = lazy(() => import("./pages/Signup"))
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"))
const ContractorAgreement = lazy(() => import("./pages/ContractorAgreement"))
const Profile = lazy(() => import("./pages/Profile"))
const AccountSettings = lazy(() => import("./pages/AccountSettings"))
const JobPosting = lazy(() => import("./components/JobPosting"))
const PostedProjectsPage = lazy(() => import("./pages/PostedProjectsPage"))

function RouteLoader() {
  return <div className="min-h-screen flex items-center justify-center">Loading...</div>
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return user ? children : <Navigate to="/login" />
}

function App() {
  return (
    <AuthProvider>
      <JobsProvider>
        <MessagesProvider>
          <SavedContractorsProvider>
            <ReviewsProvider>
              <ToastProvider>
                <ThemeProvider>
                  <Router>
                    <Suspense fallback={<RouteLoader />}>
                      <Routes>
                        <Route path="/" element={<PublicLayout><Landing /></PublicLayout>} />
                        <Route path="/how-it-works" element={<PublicLayout><HowItWorks /></PublicLayout>} />
                        <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
                        <Route path="/signup" element={<PublicLayout><Signup /></PublicLayout>} />
                        <Route path="/terms-and-conditions" element={<PublicLayout><TermsAndConditions /></PublicLayout>} />
                        <Route path="/contractor-agreement" element={<PublicLayout><ContractorAgreement /></PublicLayout>} />
                        <Route path="/contractor-signup" element={<PublicLayout><ContractorSignup /></PublicLayout>} />

                        <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout><Dashboard /></DashboardLayout></ProtectedRoute>} />
                        <Route path="/projects" element={<ProtectedRoute><DashboardLayout><ProjectFeed /></DashboardLayout></ProtectedRoute>} />
                        <Route path="/projects/:id" element={<ProtectedRoute><DashboardLayout><ProjectDetails /></DashboardLayout></ProtectedRoute>} />
                        <Route path="/messages" element={<ProtectedRoute><DashboardLayout><MessagesPage /></DashboardLayout></ProtectedRoute>} />
                        <Route path="/my-projects" element={<ProtectedRoute><DashboardLayout><MyProjects /></DashboardLayout></ProtectedRoute>} />
                        <Route path="/admin/insurance-review" element={<ProtectedRoute><DashboardLayout><AdminInsuranceReview /></DashboardLayout></ProtectedRoute>} />
                        <Route path="/admin/proskillset" element={<ProtectedRoute><DashboardLayout><AdminProSkillset /></DashboardLayout></ProtectedRoute>} />
                        <Route path="/contractors" element={<ProtectedRoute><DashboardLayout><ContractorsPage /></DashboardLayout></ProtectedRoute>} />
                        <Route path="/post-job" element={<ProtectedRoute><DashboardLayout><JobPosting /></DashboardLayout></ProtectedRoute>} />
                        <Route path="/posted-projects" element={<ProtectedRoute><DashboardLayout><PostedProjectsPage /></DashboardLayout></ProtectedRoute>} />
                        <Route path="/profile" element={<ProtectedRoute><DashboardLayout><Profile /></DashboardLayout></ProtectedRoute>} />
                        <Route path="/profile/:email" element={<ProtectedRoute><DashboardLayout><Profile /></DashboardLayout></ProtectedRoute>} />
                        <Route path="/account-settings" element={<ProtectedRoute><DashboardLayout><AccountSettings /></DashboardLayout></ProtectedRoute>} />

                        <Route path="*" element={<Navigate to="/" />} />
                      </Routes>
                    </Suspense>
                  </Router>
                </ThemeProvider>
              </ToastProvider>
            </ReviewsProvider>
          </SavedContractorsProvider>
        </MessagesProvider>
      </JobsProvider>
    </AuthProvider>
  )
}

export default App
