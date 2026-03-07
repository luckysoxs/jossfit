import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/layout/Layout'
import LoadingSpinner from './components/ui/LoadingSpinner'

import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Workouts from './pages/Workouts'
import WorkoutDetail from './pages/WorkoutDetail'
import Routines from './pages/Routines'
import RoutineDetail from './pages/RoutineDetail'
import GenerateRoutine from './pages/GenerateRoutine'
import CreateRoutine from './pages/CreateRoutine'
import Progress from './pages/Progress'
import BodyMetrics from './pages/BodyMetrics'
import Nutrition from './pages/Nutrition'
import Sleep from './pages/Sleep'
import Supplements from './pages/Supplements'
import Goals from './pages/Goals'
import Store from './pages/Store'
import Benefits from './pages/Benefits'
import Cardio from './pages/Cardio'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import SupportChat from './pages/SupportChat'
import Notes from './pages/Notes'
import NotificationCenter from './pages/NotificationCenter'
import TermsAndConditions from './pages/TermsAndConditions'
import WalkieTalkie from './pages/WalkieTalkie'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_admin) return <Navigate to="/" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/terms" element={<TermsAndConditions />} />

      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/workouts" element={<ProtectedRoute><Workouts /></ProtectedRoute>} />
      <Route path="/workouts/:id" element={<ProtectedRoute><WorkoutDetail /></ProtectedRoute>} />
      <Route path="/routines" element={<ProtectedRoute><Routines /></ProtectedRoute>} />
      <Route path="/routines/generate" element={<ProtectedRoute><GenerateRoutine /></ProtectedRoute>} />
      <Route path="/routines/create" element={<ProtectedRoute><CreateRoutine /></ProtectedRoute>} />
      <Route path="/routines/:id" element={<ProtectedRoute><RoutineDetail /></ProtectedRoute>} />
      <Route path="/progress" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
      <Route path="/body" element={<ProtectedRoute><BodyMetrics /></ProtectedRoute>} />
      <Route path="/nutrition" element={<ProtectedRoute><Nutrition /></ProtectedRoute>} />
      <Route path="/sleep" element={<ProtectedRoute><Sleep /></ProtectedRoute>} />
      <Route path="/supplements" element={<ProtectedRoute><Supplements /></ProtectedRoute>} />
      <Route path="/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
      <Route path="/store" element={<ProtectedRoute><Store /></ProtectedRoute>} />
      <Route path="/benefits" element={<ProtectedRoute><Benefits /></ProtectedRoute>} />
      <Route path="/cardio" element={<ProtectedRoute><Cardio /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/support" element={<ProtectedRoute><SupportChat /></ProtectedRoute>} />
      <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
      <Route path="/notes/:noteId" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><NotificationCenter /></ProtectedRoute>} />
      <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
      <Route path="/admin/walkie-talkie" element={<AdminRoute><WalkieTalkie /></AdminRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
