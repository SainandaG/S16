import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";

// Each page is its own download, so a visitor only loads the code for the page they open.
const Admin = lazy(() => import("./admin/AdminApp.jsx"));
const Home = lazy(() => import("./pages/Home.jsx"));
const About = lazy(() => import("./pages/About.jsx"));
const Services = lazy(() => import("./pages/Services.jsx"));
const Projects = lazy(() => import("./pages/Projects.jsx"));
const Process = lazy(() => import("./pages/Process.jsx"));
const Contact = lazy(() => import("./pages/Contact.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));
const Blog = lazy(() => import("./pages/Blog.jsx"));
const BlogPost = lazy(() => import("./pages/BlogPost.jsx"));
const Account = lazy(() => import("./pages/Account.jsx"));
const SignIn = lazy(() => import("./pages/Auth.jsx").then((m) => ({ default: m.SignIn })));
const Register = lazy(() => import("./pages/Auth.jsx").then((m) => ({ default: m.Register })));

export default function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<Suspense fallback={null}><Admin /></Suspense>} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="services" element={<Services />} />
        <Route path="projects" element={<Projects />} />
        <Route path="process" element={<Process />} />
        <Route path="contact" element={<Contact />} />
        <Route path="blog" element={<Blog />} />
        <Route path="blog/:slug" element={<BlogPost />} />
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
