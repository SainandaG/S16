import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Admin from "./admin/AdminApp.jsx";
import Home from "./pages/Home.jsx";
import About from "./pages/About.jsx";
import Services from "./pages/Services.jsx";
import Projects from "./pages/Projects.jsx";
import Process from "./pages/Process.jsx";
import Contact from "./pages/Contact.jsx";
import NotFound from "./pages/NotFound.jsx";
import Blog from "./pages/Blog.jsx";
import BlogPost from "./pages/BlogPost.jsx";
import Account from "./pages/Account.jsx";
import { SignIn, Register } from "./pages/Auth.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<Admin />} />
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
