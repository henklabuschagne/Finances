import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Transactions } from "./components/Transactions";
import { Files } from "./components/Files";
import { Categories } from "./components/Categories";
import { Upload } from "./components/Upload";
import { Budget } from "./components/Budget";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "transactions", Component: Transactions },
      { path: "files", Component: Files },
      { path: "categories", Component: Categories },
      { path: "budget", Component: Budget },
      { path: "upload", Component: Upload },
    ],
  },
]);