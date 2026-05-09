import { Authenticated, Refine } from "@refinedev/core";
import routerProvider, { NavigateToResource } from "@refinedev/react-router";
import {
  ErrorComponent,
  RefineSnackbarProvider,
  ThemedLayout,
  useNotificationProvider
} from "@refinedev/mui";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router";
import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import NewspaperOutlinedIcon from "@mui/icons-material/NewspaperOutlined";
import ViewInArOutlinedIcon from "@mui/icons-material/ViewInArOutlined";
import WidgetsOutlinedIcon from "@mui/icons-material/WidgetsOutlined";
import { authProvider, dataProvider } from "./providers";
import {
  AdminHeader,
  ClientModelPage,
  LoginPage,
  ModelPage,
  ResourceForm,
  ResourceList,
  ResourceShow
} from "./pages";
import "./admin.css";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#d7b08a"
    },
    secondary: {
      main: "#6aa08f"
    },
    background: {
      default: "#151515",
      paper: "#20201f"
    },
    text: {
      primary: "#ebe9df",
      secondary: "#b8b6ac"
    }
  },
  shape: {
    borderRadius: 8
  },
  typography: {
    fontFamily: "Inter, Segoe UI, Arial, sans-serif",
    h4: {
      fontWeight: 600
    },
    h5: {
      fontWeight: 600
    }
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          borderColor: "#3f403d"
        }
      }
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          textTransform: "none"
        }
      }
    }
  }
});

const resources = [
  {
    name: "products",
    list: "/products",
    create: "/products/create",
    edit: "/products/edit/:id",
    show: "/products/show/:id",
    meta: {
      label: "Товары",
      icon: <Inventory2OutlinedIcon />
    }
  },
  {
    name: "leads",
    list: "/leads",
    show: "/leads/show/:id",
    meta: {
      label: "Заявки",
      icon: <AssignmentOutlinedIcon />
    }
  },
  {
    name: "blog",
    list: "/blog",
    create: "/blog/create",
    edit: "/blog/edit/:id",
    show: "/blog/show/:id",
    meta: {
      label: "Блог",
      icon: <ArticleOutlinedIcon />
    }
  },
  {
    name: "news",
    list: "/news",
    create: "/news/create",
    edit: "/news/edit/:id",
    show: "/news/show/:id",
    meta: {
      label: "Новости",
      icon: <NewspaperOutlinedIcon />
    }
  },
  {
    name: "other-products",
    list: "/other-products",
    create: "/other-products/create",
    edit: "/other-products/edit/:id",
    show: "/other-products/show/:id",
    meta: {
      label: "Другие изделия",
      icon: <WidgetsOutlinedIcon />
    }
  },
  {
    name: "site-model",
    list: "/site-model",
    meta: {
      label: "3D на сайт",
      icon: <ViewInArOutlinedIcon />
    }
  },
  {
    name: "client-model",
    list: "/client-model",
    meta: {
      label: "Модель клиенту",
      icon: <ViewInArOutlinedIcon />
    }
  }
];

function AdminTitle({ collapsed }) {
  return (
    <div className="admin-title">
      <span className="admin-title-mark">Ч</span>
      {collapsed ? null : (
        <span className="admin-title-text">
          Лестницы Чайка
        </span>
      )}
    </div>
  );
}

export default function AdminApp() {
  return (
    <BrowserRouter basename="/admin">
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles styles={{ html: { WebkitFontSmoothing: "auto" } }} />
        <RefineSnackbarProvider>
          <Refine
            dataProvider={dataProvider}
            authProvider={authProvider}
            routerProvider={routerProvider}
            notificationProvider={useNotificationProvider}
            resources={resources}
            options={{
              syncWithLocation: true
            }}
          >
            <Routes>
              <Route
                element={
                  <Authenticated fallback={<Outlet />}>
                    <NavigateToResource resource="products" />
                  </Authenticated>
                }
              >
                <Route path="/login" element={<LoginPage />} />
              </Route>

              <Route
                element={
                  <Authenticated redirectOnFail="/login">
                    <ThemedLayout Header={AdminHeader} Title={AdminTitle}>
                      <Outlet />
                    </ThemedLayout>
                  </Authenticated>
                }
              >
                <Route index element={<NavigateToResource resource="products" />} />
                <Route path="leads">
                  <Route index element={<ResourceList resource="leads" />} />
                  <Route path="show/:id" element={<ResourceShow resource="leads" />} />
                </Route>
                {["products", "blog", "news", "other-products"].map((resource) => (
                  <Route path={resource} key={resource}>
                    <Route index element={<ResourceList resource={resource} />} />
                    <Route path="create" element={<ResourceForm resource={resource} mode="create" />} />
                    <Route path="edit/:id" element={<ResourceForm resource={resource} mode="edit" />} />
                    <Route path="show/:id" element={<ResourceShow resource={resource} />} />
                  </Route>
                ))}
                <Route path="site-model" element={<ModelPage />} />
                <Route path="client-model" element={<ClientModelPage />} />
                <Route path="model" element={<Navigate to="/site-model" replace />} />
              </Route>

              <Route path="/" element={<Navigate to="/products" replace />} />
              <Route path="*" element={<ErrorComponent />} />
            </Routes>
          </Refine>
        </RefineSnackbarProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
