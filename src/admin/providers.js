const TOKEN_KEY = "chaika-admin-token";

const resourcePaths = {
  products: "products",
  leads: "leads",
  blog: "blog",
  news: "news",
  "other-products": "other-products"
};

async function request(path, options = {}) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.error || `API ${response.status}: ${path}`);
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function authHeaders(headers = {}) {
  return {
    ...headers,
    Authorization: `Bearer ${getToken()}`
  };
}

function jsonOptions(method, body) {
  return {
    method,
    headers: authHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(body)
  };
}

function getResourcePath(resource) {
  const path = resourcePaths[resource];

  if (!path) {
    throw new Error(`Unknown resource: ${resource}`);
  }

  return path;
}

function readValue(record, field) {
  return field.split(".").reduce((value, key) => value?.[key], record);
}

function applyFilters(records, filters = []) {
  return records.filter((record) =>
    filters.every((filter) => {
      if ("operator" in filter && (filter.operator === "or" || filter.operator === "and")) {
        const nested = filter.value || [];
        return filter.operator === "or"
          ? nested.some((nestedFilter) => applyFilters([record], [nestedFilter]).length === 1)
          : nested.every((nestedFilter) => applyFilters([record], [nestedFilter]).length === 1);
      }

      if (filter.value === undefined || filter.value === null || filter.value === "") {
        return true;
      }

      const value = readValue(record, filter.field);
      const normalizedValue = Array.isArray(value) ? value.join(", ") : String(value ?? "");
      const normalizedFilter = String(filter.value);

      if (filter.operator === "eq") {
        return normalizedValue === normalizedFilter;
      }

      if (filter.operator === "ne") {
        return normalizedValue !== normalizedFilter;
      }

      return normalizedValue.toLowerCase().includes(normalizedFilter.toLowerCase());
    })
  );
}

function applySorters(records, sorters = []) {
  if (!sorters.length) {
    return records;
  }

  return [...records].sort((a, b) => {
    for (const sorter of sorters) {
      const left = readValue(a, sorter.field) ?? "";
      const right = readValue(b, sorter.field) ?? "";
      const result = String(left).localeCompare(String(right), "ru", { numeric: true, sensitivity: "base" });

      if (result !== 0) {
        return sorter.order === "desc" ? -result : result;
      }
    }

    return 0;
  });
}

function paginate(records, pagination) {
  if (pagination?.mode === "off") {
    return records;
  }

  const current = pagination?.current || 1;
  const pageSize = pagination?.pageSize || 25;
  const start = (current - 1) * pageSize;

  return records.slice(start, start + pageSize);
}

export const dataProvider = {
  getList: async ({ resource, pagination, filters, sorters }) => {
    const records = await request(`/api/${getResourcePath(resource)}`);
    const filtered = applyFilters(records, filters);
    const sorted = applySorters(filtered, sorters);

    return {
      data: paginate(sorted, pagination),
      total: filtered.length
    };
  },
  getOne: async ({ resource, id }) => ({
    data: await request(`/api/${getResourcePath(resource)}/${encodeURIComponent(id)}`)
  }),
  create: async ({ resource, variables }) => ({
    data: await request(`/api/${getResourcePath(resource)}`, jsonOptions("POST", variables))
  }),
  update: async ({ resource, id, variables }) => ({
    data: await request(`/api/${getResourcePath(resource)}/${encodeURIComponent(id)}`, jsonOptions("PUT", variables))
  }),
  deleteOne: async ({ resource, id }) => ({
    data: await request(`/api/${getResourcePath(resource)}/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders()
    })
  }),
  getMany: async ({ resource, ids }) => ({
    data: await Promise.all(ids.map((id) => request(`/api/${getResourcePath(resource)}/${encodeURIComponent(id)}`)))
  }),
  getApiUrl: () => "/api"
};

export const authProvider = {
  login: async ({ username, password }) => {
    try {
      const session = await request("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      localStorage.setItem(TOKEN_KEY, session.token);

      return {
        success: true,
        redirectTo: "/products"
      };
    } catch {
      return {
        success: false,
        error: {
          name: "login-error",
          message: "Неверный логин или пароль"
        }
      };
    }
  },
  logout: async () => {
    localStorage.removeItem(TOKEN_KEY);

    return {
      success: true,
      redirectTo: "/login"
    };
  },
  check: async () => {
    if (!getToken()) {
      return {
        authenticated: false,
        redirectTo: "/login"
      };
    }

    try {
      await request("/api/auth/session", {
        headers: authHeaders()
      });

      return {
        authenticated: true
      };
    } catch {
      localStorage.removeItem(TOKEN_KEY);

      return {
        authenticated: false,
        redirectTo: "/login"
      };
    }
  },
  onError: async (error) => {
    if (error.statusCode === 401) {
      return {
        logout: true,
        redirectTo: "/login"
      };
    }

    return {};
  },
  getIdentity: async () => ({
    id: "admin",
    name: "Администратор"
  })
};

export function getAdminToken() {
  return getToken();
}

export async function getModel() {
  return request("/api/model");
}

export async function updateModel(settings) {
  return request("/api/model/settings", jsonOptions("PATCH", settings));
}

export async function uploadModel(file) {
  const body = new FormData();
  body.append("model", file);

  return request("/api/model/upload", {
    method: "POST",
    headers: authHeaders(),
    body
  });
}

export async function clearModel() {
  return request("/api/model", {
    method: "DELETE",
    headers: authHeaders()
  });
}

export async function getClientModel() {
  return request("/api/client-model");
}

export async function uploadClientModel(file) {
  const body = new FormData();
  body.append("model", file);

  return request("/api/client-model/upload", {
    method: "POST",
    headers: authHeaders(),
    body
  });
}

export async function clearClientModel() {
  return request("/api/client-model", {
    method: "DELETE",
    headers: authHeaders()
  });
}

export async function createClientLink(payload) {
  return request("/api/client-links", jsonOptions("POST", payload));
}

export async function uploadProductAssets(productId, files) {
  const body = new FormData();

  if (files.cover) {
    body.append("cover", files.cover);
  }

  Array.from(files.photos || []).forEach((file) => body.append("photos", file));

  if (files.model) {
    body.append("model", files.model);
  }

  return request(`/api/products/${encodeURIComponent(productId)}/upload`, {
    method: "POST",
    headers: authHeaders(),
    body
  });
}
