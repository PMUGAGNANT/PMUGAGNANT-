import type { Metadata } from "next";
import AdminPage from "@/features/admin/AdminPage";

export const metadata: Metadata = {
  title: "Admin TurfEdge",
  description: "Cockpit prive TurfEdge pour suivre abonnements, revenus et performance algo.",
  robots: {
    index: false,
    follow: false,
  },
};

export default AdminPage;
