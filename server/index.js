import crypto from "node:crypto";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { get, put } from "@vercel/blob";
import express from "express";
import multer from "multer";
import { productModels } from "../src/content/siteData.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const dataDir = path.join(projectRoot, "data");
const uploadDir = path.join(dataDir, "uploads");
const modelUploadDir = path.join(uploadDir, "models");
const productImageDir = path.join(uploadDir, "products");
const contentFile = path.join(dataDir, "content.json");
const distPath = path.join(projectRoot, "dist");
const port = Number(process.env.PORT || 3001);
const isVercel = Boolean(process.env.VERCEL);
const blobContentPath = "cms/content.json";
const adminUsername = "admin";
const adminPassword = "555837";
const adminSecret = process.env.ADMIN_SECRET || "chaika-admin-local-secret";
const sketchupApiKey = process.env.SKETCHUP_API_KEY || adminSecret;
const telegramBotUsername = process.env.TELEGRAM_BOT_USERNAME || "YourBot";

const defaultModelSettings = {
  cameraAngle: "axon",
  showLines: false,
  shadows: true
};

const defaultContent = {
  products: productModels,
  blog: [],
  news: [
    {
      id: "news-glb-viewer",
      title: "Запущен web-просмотр 3D-моделей",
      excerpt: "GLB-модели можно смотреть прямо на сайте: вращение, масштаб, линии граней и тени настраиваются из панели.",
      publishedAt: "2026-05-05"
    }
  ],
  otherProducts: [
    {
      id: "metal-furniture",
      title: "Мебель из металла",
      description: "Каркасы столов, консоли, стеллажи и стойки под интерьерные проекты.",
      tags: ["столы", "консоли", "стеллажи"]
    },
    {
      id: "furniture-parts",
      title: "Элементы мебели из металла",
      description: "Опоры, рамы, декоративные детали и узлы под дальнейшую отделку.",
      tags: ["опоры", "рамы", "узлы"]
    },
    {
      id: "custom-metal",
      title: "Изделия по чертежам",
      description: "Небольшие партии и индивидуальные металлоконструкции для дома, бизнеса и дизайнеров.",
      tags: ["чертежи", "порошковая окраска", "ЧПУ"]
    }
  ],
  model: {
    activeFile: null,
    settings: defaultModelSettings
  },
  clientLinks: []
};

async function ensureStorage() {
  if (isVercel) {
    return;
  }

  await fs.mkdir(modelUploadDir, { recursive: true });
  await fs.mkdir(productImageDir, { recursive: true });

  if (!existsSync(contentFile)) {
    await fs.writeFile(contentFile, JSON.stringify(defaultContent, null, 2), "utf8");
  }
}

function mergeContent(content = {}) {
  return {
    ...defaultContent,
    ...content,
    products: content.products?.length ? content.products : defaultContent.products,
    model: {
      ...defaultContent.model,
      ...content.model,
      settings: {
        ...defaultModelSettings,
        ...content.model?.settings
      }
    },
    clientLinks: Array.isArray(content.clientLinks) ? content.clientLinks : []
  };
}

function requireBlobToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const error = new Error("На Vercel не настроен Blob Storage: добавьте BLOB_READ_WRITE_TOKEN.");
    error.statusCode = 503;
    throw error;
  }
}

async function readContent() {
  if (isVercel && process.env.BLOB_READ_WRITE_TOKEN) {
    const storedContent = await get(blobContentPath, { access: "public" });

    if (storedContent?.stream) {
      const raw = await new Response(storedContent.stream).text();
      return mergeContent(JSON.parse(raw));
    }
  }

  const raw = await fs.readFile(contentFile, "utf8");
  return mergeContent(JSON.parse(raw));
}

async function writeContent(content) {
  if (isVercel) {
    requireBlobToken();
    await put(blobContentPath, JSON.stringify(content, null, 2), {
      access: "public",
      allowOverwrite: true,
      contentType: "application/json"
    });
    return;
  }

  await fs.writeFile(contentFile, JSON.stringify(content, null, 2), "utf8");
}

function createEntry(body, extra = {}) {
  return {
    id: body.id || crypto.randomUUID(),
    title: body.title,
    excerpt: body.excerpt || body.description || "",
    publishedAt: body.publishedAt || new Date().toISOString().slice(0, 10),
    ...extra,
    ...body
  };
}

function signAdminToken() {
  const payload = Buffer.from(
    JSON.stringify({
      user: adminUsername,
      exp: Date.now() + 1000 * 60 * 60 * 12
    })
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", adminSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyAdminToken(token) {
  if (!token) {
    return false;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return false;
  }

  const expected = crypto.createHmac("sha256", adminSecret).update(payload).digest("base64url");
  if (signature.length !== expected.length) {
    return false;
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return false;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.user === adminUsername && data.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  const token = req.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: "Admin auth required" });
    return;
  }

  next();
}

function requireSketchUpExport(req, res, next) {
  const apiKey = req.get("x-sketchup-api-key");

  if (!apiKey || apiKey !== sketchupApiKey) {
    res.status(401).json({ error: "SketchUp export key required" });
    return;
  }

  next();
}

function normalizeUploadedName(name) {
  const value = String(name || "");

  if (!/[\u00c3\u00d0\u00d1]/.test(value)) {
    return value;
  }

  const decoded = Buffer.from(value, "latin1").toString("utf8");
  return decoded.includes("\uFFFD") ? value : decoded;
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function normalizeSpecs(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => (Array.isArray(row) ? [String(row[0] || "").trim(), String(row[1] || "").trim()] : null))
    .filter((row) => row?.[0] && row?.[1]);
}

function normalizeProduct(body, existing = {}) {
  return {
    ...existing,
    ...body,
    id: String(body.id || existing.id || crypto.randomUUID()).trim(),
    title: String(body.title || existing.title || "Новая модель").trim(),
    type: String(body.type || existing.type || "").trim(),
    cover: String(body.cover || existing.cover || "").trim(),
    description: String(body.description || existing.description || "").trim(),
    modelUrl: String(body.modelUrl || existing.modelUrl || "").trim(),
    specs: normalizeSpecs(body.specs || existing.specs),
    details: normalizeStringArray(body.details || existing.details),
    photos: normalizeStringArray(body.photos || existing.photos)
  };
}

function createClientLinkResponse(link) {
  return {
    ...link,
    publicPath: `/client/${link.token}`,
    browserPath: `/viewer/${link.token}`,
    telegramUrl: `https://t.me/${telegramBotUsername}?startapp=${encodeURIComponent(link.token)}`
  };
}

async function storeUploadedFile(file, folder) {
  if (!file) {
    return "";
  }

  if (!isVercel) {
    return `/uploads/${folder}/${file.filename}`;
  }

  requireBlobToken();
  const extension = path.extname(file.originalname).toLowerCase() || (folder === "models" ? ".glb" : "");
  const blob = await put(`uploads/${folder}/${crypto.randomUUID()}${extension}`, file.buffer, {
    access: "public",
    contentType: file.mimetype || undefined,
    multipart: file.size > 5 * 1024 * 1024
  });

  return blob.url;
}

const upload = multer({
  storage: isVercel
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (_req, _file, callback) => callback(null, modelUploadDir),
        filename: (_req, file, callback) => {
          const extension = path.extname(file.originalname).toLowerCase() || ".glb";
          callback(null, `${crypto.randomUUID()}${extension}`);
        }
      }),
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, extension === ".glb" || extension === ".gltf");
  },
  limits: {
    fileSize: 150 * 1024 * 1024
  }
});

const productUpload = multer({
  storage: isVercel
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (_req, file, callback) => {
          callback(null, file.fieldname === "model" ? modelUploadDir : productImageDir);
        },
        filename: (_req, file, callback) => {
          const extension = path.extname(file.originalname).toLowerCase();
          callback(null, `${crypto.randomUUID()}${extension}`);
        }
      }),
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
    const modelExtensions = new Set([".glb", ".gltf"]);
    callback(null, file.fieldname === "model" ? modelExtensions.has(extension) : imageExtensions.has(extension));
  },
  limits: {
    fileSize: 150 * 1024 * 1024
  }
});

await ensureStorage();

export const app = express();
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(uploadDir));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/login", (req, res) => {
  if (req.body?.username !== adminUsername || req.body?.password !== adminPassword) {
    res.status(401).json({ error: "Invalid login or password" });
    return;
  }

  res.json({ token: signAdminToken(), user: adminUsername });
});

app.get("/api/auth/session", requireAdmin, (_req, res) => {
  res.json({ user: adminUsername });
});

app.get("/api/content", async (_req, res) => {
  res.json(await readContent());
});

app.get("/api/blog", async (_req, res) => {
  const content = await readContent();
  res.json(content.blog);
});

app.get("/api/products", async (_req, res) => {
  const content = await readContent();
  res.json(content.products);
});

app.get("/api/products/:id", async (req, res) => {
  const content = await readContent();
  const entry = content.products.find((product) => product.id === req.params.id);

  if (!entry) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(entry);
});

app.post("/api/products", requireAdmin, async (req, res) => {
  const content = await readContent();
  const entry = normalizeProduct(req.body);
  content.products.unshift(entry);
  await writeContent(content);
  res.status(201).json(entry);
});

app.put("/api/products/:id", requireAdmin, async (req, res) => {
  const content = await readContent();
  const index = content.products.findIndex((product) => product.id === req.params.id);
  const entry = normalizeProduct({ ...req.body, id: req.params.id }, content.products[index]);

  if (index === -1) {
    content.products.unshift(entry);
  } else {
    content.products[index] = entry;
  }

  await writeContent(content);
  res.json(entry);
});

app.delete("/api/products/:id", requireAdmin, async (req, res) => {
  const content = await readContent();
  const nextProducts = content.products.filter((product) => product.id !== req.params.id);

  if (nextProducts.length === content.products.length) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  content.products = nextProducts;
  await writeContent(content);
  res.json({ id: req.params.id });
});

app.post(
  "/api/products/:id/upload",
  requireAdmin,
  productUpload.fields([
    { name: "cover", maxCount: 1 },
    { name: "photos", maxCount: 8 },
    { name: "model", maxCount: 1 }
  ]),
  async (req, res) => {
    const content = await readContent();
    const product = content.products.find((item) => item.id === req.params.id);

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const cover = req.files?.cover?.[0];
    const photos = req.files?.photos || [];
    const model = req.files?.model?.[0];

    if (cover) {
      product.cover = await storeUploadedFile(cover, "products");
    }

    if (photos.length) {
      product.photos = [
        ...(product.photos || []),
        ...(await Promise.all(photos.map((file) => storeUploadedFile(file, "products"))))
      ];
    }

    if (model) {
      product.modelUrl = await storeUploadedFile(model, "models");
    }

    await writeContent(content);
    res.json(product);
  }
);

app.get("/api/sketchup/products", requireSketchUpExport, async (_req, res) => {
  const content = await readContent();
  res.json(content.products.map(({ id, title }) => ({ id, title })));
});

app.post("/api/sketchup/model/upload", requireSketchUpExport, upload.single("model"), async (req, res) => {
  const content = await readContent();
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: "GLB or GLTF file required" });
    return;
  }

  const activeFile = {
    name: normalizeUploadedName(file.originalname),
    size: file.size,
    url: await storeUploadedFile(file, "models"),
    uploadedAt: new Date().toISOString()
  };

  content.model.activeFile = activeFile;
  await writeContent(content);
  res.status(201).json(content.model);
});

app.post("/api/sketchup/products/:id/upload", requireSketchUpExport, upload.single("model"), async (req, res) => {
  const content = await readContent();
  const product = content.products.find((item) => item.id === req.params.id);
  const file = req.file;

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  if (!file) {
    res.status(400).json({ error: "GLB or GLTF file required" });
    return;
  }

  product.modelUrl = await storeUploadedFile(file, "models");
  await writeContent(content);
  res.status(201).json(product);
});

app.post("/api/blog", requireAdmin, async (req, res) => {
  const content = await readContent();
  const entry = createEntry(req.body, { slug: req.body.slug || crypto.randomUUID(), keywords: req.body.keywords || [] });
  content.blog.unshift(entry);
  await writeContent(content);
  res.status(201).json(entry);
});

app.get("/api/blog/:id", async (req, res) => {
  const content = await readContent();
  const entry = content.blog.find((item) => item.id === req.params.id);

  if (!entry) {
    res.status(404).json({ error: "Blog post not found" });
    return;
  }

  res.json(entry);
});

app.put("/api/blog/:id", requireAdmin, async (req, res) => {
  const content = await readContent();
  const index = content.blog.findIndex((item) => item.id === req.params.id);

  if (index === -1) {
    res.status(404).json({ error: "Blog post not found" });
    return;
  }

  const existing = content.blog[index];
  const entry = {
    ...existing,
    ...req.body,
    id: req.params.id,
    slug: req.body.slug || existing.slug,
    keywords: normalizeStringArray(req.body.keywords || existing.keywords)
  };
  content.blog[index] = entry;
  await writeContent(content);
  res.json(entry);
});

app.delete("/api/blog/:id", requireAdmin, async (req, res) => {
  const content = await readContent();
  const nextBlog = content.blog.filter((item) => item.id !== req.params.id);

  if (nextBlog.length === content.blog.length) {
    res.status(404).json({ error: "Blog post not found" });
    return;
  }

  content.blog = nextBlog;
  await writeContent(content);
  res.json({ id: req.params.id });
});

app.get("/api/news", async (_req, res) => {
  const content = await readContent();
  res.json(content.news);
});

app.post("/api/news", requireAdmin, async (req, res) => {
  const content = await readContent();
  const entry = createEntry(req.body);
  content.news.unshift(entry);
  await writeContent(content);
  res.status(201).json(entry);
});

app.get("/api/news/:id", async (req, res) => {
  const content = await readContent();
  const entry = content.news.find((item) => item.id === req.params.id);

  if (!entry) {
    res.status(404).json({ error: "News item not found" });
    return;
  }

  res.json(entry);
});

app.put("/api/news/:id", requireAdmin, async (req, res) => {
  const content = await readContent();
  const index = content.news.findIndex((item) => item.id === req.params.id);

  if (index === -1) {
    res.status(404).json({ error: "News item not found" });
    return;
  }

  const entry = {
    ...content.news[index],
    ...req.body,
    id: req.params.id
  };
  content.news[index] = entry;
  await writeContent(content);
  res.json(entry);
});

app.delete("/api/news/:id", requireAdmin, async (req, res) => {
  const content = await readContent();
  const nextNews = content.news.filter((item) => item.id !== req.params.id);

  if (nextNews.length === content.news.length) {
    res.status(404).json({ error: "News item not found" });
    return;
  }

  content.news = nextNews;
  await writeContent(content);
  res.json({ id: req.params.id });
});

app.get("/api/other-products", async (_req, res) => {
  const content = await readContent();
  res.json(content.otherProducts);
});

app.post("/api/other-products", requireAdmin, async (req, res) => {
  const content = await readContent();
  const entry = createEntry(req.body, { description: req.body.description || req.body.excerpt || "", tags: req.body.tags || [] });
  content.otherProducts.unshift(entry);
  await writeContent(content);
  res.status(201).json(entry);
});

app.get("/api/other-products/:id", async (req, res) => {
  const content = await readContent();
  const entry = content.otherProducts.find((item) => item.id === req.params.id);

  if (!entry) {
    res.status(404).json({ error: "Other product not found" });
    return;
  }

  res.json(entry);
});

app.put("/api/other-products/:id", requireAdmin, async (req, res) => {
  const content = await readContent();
  const index = content.otherProducts.findIndex((item) => item.id === req.params.id);

  if (index === -1) {
    res.status(404).json({ error: "Other product not found" });
    return;
  }

  const entry = {
    ...content.otherProducts[index],
    ...req.body,
    id: req.params.id,
    description: req.body.description || req.body.excerpt || content.otherProducts[index].description || "",
    tags: normalizeStringArray(req.body.tags || content.otherProducts[index].tags)
  };
  content.otherProducts[index] = entry;
  await writeContent(content);
  res.json(entry);
});

app.delete("/api/other-products/:id", requireAdmin, async (req, res) => {
  const content = await readContent();
  const nextOtherProducts = content.otherProducts.filter((item) => item.id !== req.params.id);

  if (nextOtherProducts.length === content.otherProducts.length) {
    res.status(404).json({ error: "Other product not found" });
    return;
  }

  content.otherProducts = nextOtherProducts;
  await writeContent(content);
  res.json({ id: req.params.id });
});

app.get("/api/model", async (_req, res) => {
  const content = await readContent();
  res.json(content.model);
});

app.patch("/api/model/settings", requireAdmin, async (req, res) => {
  const content = await readContent();
  content.model.settings = {
    ...content.model.settings,
    cameraAngle: req.body.cameraAngle || content.model.settings.cameraAngle,
    showLines: typeof req.body.showLines === "boolean" ? req.body.showLines : content.model.settings.showLines,
    shadows: typeof req.body.shadows === "boolean" ? req.body.shadows : content.model.settings.shadows
  };
  await writeContent(content);
  res.json(content.model);
});

app.post("/api/model/upload", requireAdmin, upload.single("model"), async (req, res) => {
  const content = await readContent();
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: "GLB or GLTF file required" });
    return;
  }

  const activeFile = {
    name: normalizeUploadedName(file.originalname),
    size: file.size,
    url: await storeUploadedFile(file, "models"),
    uploadedAt: new Date().toISOString()
  };

  content.model.activeFile = activeFile;
  await writeContent(content);
  res.status(201).json(content.model);
});

app.post("/api/review-model/upload", upload.single("model"), async (req, res) => {
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: "GLB or GLTF file required" });
    return;
  }

  res.status(201).json({
    name: normalizeUploadedName(file.originalname),
    size: file.size,
    url: await storeUploadedFile(file, "models"),
    uploadedAt: new Date().toISOString()
  });
});

app.delete("/api/model", requireAdmin, async (_req, res) => {
  const content = await readContent();
  content.model.activeFile = null;
  await writeContent(content);
  res.json(content.model);
});

app.get("/api/client-links", requireAdmin, async (_req, res) => {
  const content = await readContent();
  res.json(content.clientLinks.map(createClientLinkResponse));
});

app.post("/api/client-links", requireAdmin, async (req, res) => {
  const content = await readContent();
  const product = req.body.productId
    ? content.products.find((item) => item.id === req.body.productId)
    : null;
  const modelUrl = String(req.body.modelUrl || product?.modelUrl || content.model.activeFile?.url || "").trim();

  if (!modelUrl) {
    res.status(400).json({ error: "Model URL required" });
    return;
  }

  let token = String(req.body.token || crypto.randomBytes(8).toString("base64url")).replace(/[^a-zA-Z0-9_-]/g, "");
  while (!token || content.clientLinks.some((link) => link.token === token)) {
    token = crypto.randomBytes(8).toString("base64url");
  }

  const link = {
    token,
    title: String(req.body.title || product?.title || content.model.activeFile?.name || "Лестница").trim(),
    modelUrl,
    productId: product?.id || null,
    createdAt: new Date().toISOString()
  };

  content.clientLinks.unshift(link);
  await writeContent(content);
  res.status(201).json(createClientLinkResponse(link));
});

app.get("/api/client-links/:token", async (req, res) => {
  const content = await readContent();
  const link = content.clientLinks.find((item) => item.token === req.params.token);

  if (!link) {
    res.status(404).json({ error: "Client link not found" });
    return;
  }

  res.json(createClientLinkResponse(link));
});

app.use((error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  res.status(error.statusCode || 500).json({ error: error.message || "Server error" });
});

if (!isVercel && existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^(?!\/api\/|\/uploads\/).*/, (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

if (!isVercel) {
  app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
  });
}

export default app;
