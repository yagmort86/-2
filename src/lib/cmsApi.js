async function request(path, options) {
  const response = await fetch(path, options);

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${path}`);
  }

  return response.json();
}

function adminHeaders(token, headers = {}) {
  return {
    ...headers,
    Authorization: `Bearer ${token}`
  };
}

export function getContent() {
  return request("/api/content");
}

export function createLead(lead) {
  if (lead instanceof FormData) {
    return request("/api/leads", {
      method: "POST",
      body: lead
    });
  }

  return request("/api/leads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(lead)
  });
}

export function loginAdmin(credentials) {
  return request("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(credentials)
  });
}

export function uploadModelFile(file) {
  const body = new FormData();
  body.append("model", file);

  return request("/api/model/upload", {
    method: "POST",
    body
  });
}

export function uploadReviewModelFile(file) {
  const body = new FormData();
  body.append("model", file);

  return request("/api/review-model/upload", {
    method: "POST",
    body
  });
}

export function updateModelSettings(settings) {
  return request("/api/model/settings", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(settings)
  });
}

export function clearModelFile() {
  return request("/api/model", {
    method: "DELETE"
  });
}

export function saveProduct(product, token) {
  return request(`/api/products/${encodeURIComponent(product.id)}`, {
    method: "PUT",
    headers: adminHeaders(token, {
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(product)
  });
}

export function uploadProductAssets(productId, files, token) {
  const body = new FormData();

  if (files.cover) {
    body.append("cover", files.cover);
  }

  files.photos?.forEach((file) => body.append("photos", file));

  if (files.model) {
    body.append("model", files.model);
  }

  return request(`/api/products/${encodeURIComponent(productId)}/upload`, {
    method: "POST",
    headers: adminHeaders(token),
    body
  });
}

export function createBlogPost(entry, token) {
  return request("/api/blog", {
    method: "POST",
    headers: adminHeaders(token, {
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(entry)
  });
}

export function createNewsItem(entry, token) {
  return request("/api/news", {
    method: "POST",
    headers: adminHeaders(token, {
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(entry)
  });
}

export function createOtherProduct(entry, token) {
  return request("/api/other-products", {
    method: "POST",
    headers: adminHeaders(token, {
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(entry)
  });
}
