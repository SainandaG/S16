import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import About from "./pages/About.jsx";
import Services from "./pages/Services.jsx";
import Projects from "./pages/Projects.jsx";
import Contact from "./pages/Contact.jsx";
import NotFound from "./pages/NotFound.jsx";
import Account from "./pages/Account.jsx";
import { SignIn, Register } from "./pages/Auth.jsx";

// Pages that are rarely needed first, or are heavy, are downloaded only when visited:
// the 3D Process page, the journal (markdown) and the admin.
const Admin = lazy(() => import("./admin/AdminApp.jsx"));
const Process = lazy(() => import("./pages/Process.jsx"));
const Blog = lazy(() => import("./pages/Blog.jsx"));
const BlogPost = lazy(() => import("./pages/BlogPost.jsx"));

export default function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<Suspense fallback={null}><Admin /></Suspense>} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="services" element={<Services />} />
        <Route path="projects" element={<Projects />} />
        <Route path="process" element={<Suspense fallback={null}><Process /></Suspense>} />
        <Route path="contact" element={<Contact />} />
        <Route path="blog" element={<Suspense fallback={null}><Blog /></Suspense>} />
        <Route path="blog/:slug" element={<Suspense fallback={null}><BlogPost /></Suspense>} />
        <Route path="login" element={<SignIn />} />
        <Route path="register" element={<Register />} />
        <Route path="account" element={<Account />} />
        {/* old paths from the first version of the site */}
        <Route path="portfolio" element={<Navigate to="/projects" replace />} />
        <Route path="3d-view" element={<Navigate to="/process" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
