import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, Check, Mail, MapPin, Menu, MessageCircle, Paperclip, Ruler, ShieldCheck, Upload, X } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { blogPosts } from "./content/blogPosts";
import { fallbackNews, fallbackOtherProducts } from "./content/cmsFallback";
import { workGalleries } from "./content/workGalleries";
import {
  createBlogPost,
  createLead,
  createNewsItem,
  createOtherProduct,
  getContent,
  loginAdmin,
  saveProduct,
  uploadProductAssets,
  uploadReviewModelFile
} from "./lib/cmsApi";
import { loadStoredModel } from "./lib/modelStore";
import {
  audiences,
  deliverables,
  frameTypes,
  heroBenefits,
  packages,
  processSteps,
  productModels,
  serviceAreas,
  sketchModels,
  trustPoints,
  woodOptions
} from "./content/siteData";
import "./styles.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const ModelViewer3D = lazy(() =>
  import("./components/ModelViewer3D").then((module) => ({ default: module.ModelViewer3D }))
);

const MODEL_SETTINGS_KEY = "chaika-model-viewer-settings";
const ADMIN_TOKEN_KEY = "chaika-admin-token";
const defaultModelSettings = {
  cameraAngle: "axon",
  showLines: false,
  shadows: true
};

const productModelSettings = {
  cameraAngle: "axon",
  showLines: false,
  lineColor: "dark",
  softShadows: true,
  shadows: true,
  background: "white",
  autoRotate: false
};

const navigation = [
  { href: "#catalog", label: "Типы" },
  { href: "#gallery", label: "Работы" },
  { href: "#viewer3d", label: "3D" },
  { href: "#process", label: "Процесс" },
  { href: "#blog", label: "Блог" },
  { href: "#request", label: "Расчет" }
];

const faqItems = [
  {
    question: "Можно ли собрать каркас самостоятельно?",
    answer: "Да. Комплект поставляется с крепежом и схемой сборки. Если объект с отделкой или сложным проемом, лучше заказать монтаж нашей бригадой."
  },
  {
    question: "Нужна ли сварка на объекте?",
    answer: "Нет. Основные работы выполняются в цеху: проект, резка, контрольная сборка и покраска. На объекте каркас собирается на крепеж."
  },
  {
    question: "Что нужно для предварительного расчета?",
    answer: "Достаточно фото проема, размеров или плана дома. Если данных мало, подскажем, какие размеры доснять."
  },
  {
    question: "Работаете только в одном городе?",
    answer: "Нет. Производим каркасы и работаем с объектами по России. Формат доставки и монтажа зависит от региона и комплектации."
  }
];

const cadViews = [
  { id: "side", label: "Вид сбоку", note: "линия марша и опоры" },
  { id: "front", label: "Фасад", note: "ширина, стойки, ступени" },
  { id: "axon", label: "Аксонометрия", note: "объемная посадка каркаса" }
];

function readModelSettings() {
  try {
    const raw = localStorage.getItem(MODEL_SETTINGS_KEY);
    return raw ? { ...defaultModelSettings, ...JSON.parse(raw) } : defaultModelSettings;
  } catch {
    return defaultModelSettings;
  }
}

function formatFileSize(size) {
  if (!size) {
    return "";
  }

  return `${(size / 1024 / 1024).toFixed(1)} МБ`;
}

function formatPhoneInput(value) {
  const raw = value.trim();

  if (!raw || raw.startsWith("@") || raw.includes("@") || /[a-zA-Zа-яА-Я]/.test(raw)) {
    return value;
  }

  let digits = raw.replace(/\D/g, "");

  if (!digits) {
    return value;
  }

  if (digits.startsWith("8")) {
    digits = `7${digits.slice(1)}`;
  }

  if (!digits.startsWith("7")) {
    digits = `7${digits}`;
  }

  const body = digits.slice(1, 11);
  const parts = [
    body.slice(0, 3),
    body.slice(3, 6),
    body.slice(6, 8),
    body.slice(8, 10)
  ];

  let phone = "+7";

  if (parts[0]) {
    phone += ` (${parts[0]}`;
  }

  if (parts[0]?.length === 3) {
    phone += ")";
  }

  if (parts[1]) {
    phone += ` ${parts[1]}`;
  }

  if (parts[2]) {
    phone += `-${parts[2]}`;
  }

  if (parts[3]) {
    phone += `-${parts[3]}`;
  }

  return phone;
}

function validateContact(method, contact) {
  const value = contact.trim();
  const digits = value.replace(/\D/g, "");
  const isPhone = /^\+7\s?\(?\d{3}\)?\s?\d{3}[-\s]?\d{2}[-\s]?\d{2}$/.test(value) && digits.length === 11;
  const isUsername = /^@[a-zA-Z0-9_]{5,32}$/.test(value);
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isChatId = /^-?\d{5,20}$/.test(value);

  if (method === "phone") {
    return isPhone;
  }

  if (method === "telegram") {
    return isUsername || isChatId;
  }

  if (method === "email") {
    return isEmail;
  }

  if (method === "max") {
    return isPhone || isChatId || isUsername;
  }

  return isPhone || isUsername || isEmail || isChatId;
}

function decodeUploadedName(name) {
  const value = String(name || "");

  if (!/[\u00c3\u00d0\u00d1]/.test(value)) {
    return value;
  }

  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder("utf-8").decode(bytes);
    return decoded.includes("\uFFFD") ? value : decoded;
  } catch {
    return value;
  }
}

function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOnDarkSurface, setIsOnDarkSurface] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    function syncHeaderState() {
      setIsScrolled(window.scrollY > 18);

      const probeY = 108;
      const darkSections = Array.from(document.querySelectorAll('[data-header-tone="dark"]'));
      setIsOnDarkSurface(
        darkSections.some((section) => {
          const rect = section.getBoundingClientRect();
          return rect.top <= probeY && rect.bottom >= 12;
        })
      );
    }

    syncHeaderState();
    window.addEventListener("scroll", syncHeaderState, { passive: true });
    window.addEventListener("resize", syncHeaderState);

    return () => {
      window.removeEventListener("scroll", syncHeaderState);
      window.removeEventListener("resize", syncHeaderState);
    };
  }, []);

  const toneClass = isScrolled || isOnDarkSurface ? "is-dark" : "is-light";

  return (
    <header className={`site-header ${toneClass} ${isScrolled ? "is-scrolled" : ""} ${isMenuOpen ? "is-open" : ""}`}>
      <div className="header-shell">
        <div className="header-frame">
          <a className="brand-tile header-brand-tile" href="#top" aria-label="На первый экран">
            <img className="brand-logo" src="/materials/logo-chaika.png" alt="Лестницы Чайка" />
          </a>

          <a className="brand-copy" href="#top">
            <strong>Лестницы Чайка</strong>
            <span>
              проект / производство / монтаж / <em>без переделок</em>
            </span>
          </a>

          <nav className="desktop-nav" aria-label="Основная навигация">
            {navigation.map((item) => (
              <a href={item.href} key={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="header-actions">
            <a className="header-ghost" href="#gallery">Смотреть работы</a>
            <a className="button primary header-cta" href="#request">
              Обсудить проект
              <ArrowRight size={16} />
            </a>
          </div>

          <button
            className="menu-toggle"
            type="button"
            aria-label={isMenuOpen ? "Закрыть меню" : "Открыть меню"}
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            {isMenuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>

          {isMenuOpen ? (
            <nav className="mobile-nav" aria-label="Мобильная навигация">
              {navigation.map((item) => (
                <a href={item.href} key={item.href} onClick={() => setIsMenuOpen(false)}>
                  {item.label}
                </a>
              ))}
              <a className="button primary" href="#request" onClick={() => setIsMenuOpen(false)}>
                Обсудить проект
              </a>
            </nav>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function SectionHeader({ eyebrow, title, text }) {
  return (
    <div className="section-header reveal">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {text ? <p>{text}</p> : null}
    </div>
  );
}

function LeadForm({ requestContext }) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [contactMethod, setContactMethod] = useState("phone");
  const [contact, setContact] = useState("");
  const [attachedFiles, setAttachedFiles] = useState([]);

  useEffect(() => {
    if (!requestContext) {
      return;
    }

    setMessage(
      `Интересует модель: ${requestContext.productTitle}. Древесина: ${requestContext.woodTitle}.`
    );
  }, [requestContext]);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setSubmitting(true);
    setSubmitted(false);
    setError("");

    try {
      if (!validateContact(contactMethod, contact)) {
        throw new Error("invalid-contact");
      }

      formData.set("contactMethod", contactMethod);
      formData.set("contact", contact);
      formData.set("page", window.location.href);

      await createLead(formData);
      setSubmitted(true);
      form.reset();
      setMessage("");
      setContact("");
      setContactMethod("phone");
      setAttachedFiles([]);
    } catch {
      setError("Проверьте контакт: телефон должен быть в формате +7, Telegram username начинаться с @, email должен быть корректным.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleContactChange(event) {
    const value = event.target.value;
    setContact(contactMethod === "phone" ? formatPhoneInput(value) : value);
  }

  function handleContactMethodChange(event) {
    const nextMethod = event.target.value;
    setContactMethod(nextMethod);

    if (nextMethod === "phone") {
      setContact((current) => formatPhoneInput(current));
    }
  }

  function handleFilesChange(event) {
    setAttachedFiles(Array.from(event.target.files || []));
  }

  return (
    <form className="lead-form reveal" onSubmit={handleSubmit}>
      <div className="form-heading">
        <span className="eyebrow">Заявка на расчет</span>
        <h3>Пришлите вводные. Подготовим предварительную стоимость и вариант каркаса.</h3>
      </div>

      {requestContext ? (
        <p className="form-context">
          В заявке: {requestContext.productTitle} / {requestContext.woodTitle}
        </p>
      ) : null}

      <input name="productModel" type="hidden" value={requestContext?.productTitle ?? ""} readOnly />
      <input name="woodType" type="hidden" value={requestContext?.woodTitle ?? ""} readOnly />

      <label>
        Имя
        <input name="name" type="text" placeholder="Как к вам обращаться" autoComplete="name" required />
      </label>

      <label>
        Город или регион
        <input name="region" type="text" placeholder="Например: Москва, Казань, Краснодар" autoComplete="address-level2" required />
      </label>

      <fieldset>
        <legend>Куда отправить расчет</legend>
        <div className="contact-options">
          <label>
            <input type="radio" name="contactMethod" value="phone" checked={contactMethod === "phone"} onChange={handleContactMethodChange} />
            <MessageCircle size={18} />
            Телефон
          </label>
          <label>
            <input type="radio" name="contactMethod" value="max" checked={contactMethod === "max"} onChange={handleContactMethodChange} />
            <MessageCircle size={18} />
            MAX
          </label>
          <label>
            <input type="radio" name="contactMethod" value="telegram" checked={contactMethod === "telegram"} onChange={handleContactMethodChange} />
            <MessageCircle size={18} />
            Telegram
          </label>
          <label>
            <input type="radio" name="contactMethod" value="email" checked={contactMethod === "email"} onChange={handleContactMethodChange} />
            <Mail size={18} />
            Почта
          </label>
        </div>
      </fieldset>

      <label>
        Контакт
        <input
          name="contact"
          type="text"
          placeholder="Телефон +7, @username, chat id или email"
          value={contact}
          onChange={handleContactChange}
          autoComplete="tel"
          required
        />
      </label>

      <label>
        Напишите комментарий
        <textarea
          name="message"
          placeholder="Фото проема, размеры, план дома, этап ремонта"
          rows="3"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </label>

      <label className="lead-file-field">
        <span>Файлы</span>
        <span className="button secondary lead-file-button">
          <Paperclip size={17} />
          Приложить файл
          <input
            name="files"
            type="file"
            accept="image/*,.pdf,.dwg,.dxf,.skp,.step,.stp,.ifc,.doc,.docx,.xls,.xlsx,.zip,.rar"
            multiple
            onChange={handleFilesChange}
          />
        </span>
        <small>Можно приложить фото проема, PDF, чертежи, планы, замеры и другие материалы.</small>
        {attachedFiles.length ? (
          <span className="lead-file-list">
            {attachedFiles.map((file) => file.name).join(", ")}
          </span>
        ) : null}
      </label>

      <button className="button primary" type="submit" disabled={submitting}>
        Получить расчет
        <ArrowRight size={18} />
      </button>

      <p className="form-note">Работаем по России. Предварительный расчет можно сделать по фото, плану или размерам.</p>
      {submitted ? <p className="form-success">Заявка принята. Ответим выбранным способом.</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}

function CadSketch({ viewId }) {
  return (
    <div className={`cad-sketch cad-sketch-${viewId}`} aria-hidden="true">
      <span className="cad-axis cad-axis-x" />
      <span className="cad-axis cad-axis-y" />
      <span className="cad-beam" />
      {Array.from({ length: 7 }).map((_, index) => (
        <span className="cad-step" key={index} style={{ "--i": index }} />
      ))}
      <span className="cad-support cad-support-a" />
      <span className="cad-support cad-support-b" />
      <span className="cad-measure cad-measure-a">3200</span>
      <span className="cad-measure cad-measure-b">180</span>
    </div>
  );
}

function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setIsVisible(window.scrollY > 360);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function handleClick() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <button
      className={`scroll-top-button ${isVisible ? "is-visible" : ""}`}
      type="button"
      aria-label="Вернуться наверх"
      aria-hidden={!isVisible}
      tabIndex={isVisible ? 0 : -1}
      onClick={handleClick}
    >
      <span aria-hidden="true">
        <ArrowUp size={17} />
      </span>
      <em>Наверх</em>
    </button>
  );
}

function ProductModal({ product, onClose, onDiscuss }) {
  const [selectedWoodId, setSelectedWoodId] = useState(woodOptions[0].id);
  const [selectedGalleryId, setSelectedGalleryId] = useState("photo");

  useEffect(() => {
    if (product) {
      setSelectedWoodId(woodOptions[0].id);
      setSelectedGalleryId("photo-0");
    }
  }, [product]);

  if (!product) {
    return null;
  }

  const selectedWood = woodOptions.find((wood) => wood.id === selectedWoodId) ?? woodOptions[0];
  const productPhotos = [product.cover, ...(product.photos || [])].filter(Boolean).filter((url, index, urls) => urls.indexOf(url) === index);
  const galleryItems = [
    ...productPhotos.map((url, index) => ({
      id: `photo-${index}`,
      kind: "photo",
      url,
      label: index === 0 ? "Фото объекта" : `Фото ${index + 1}`,
      note: "реальный объект"
    })),
    { id: "model", kind: "model", label: "3D просмотр", note: "GLB, грани, белый фон" },
    ...cadViews.map((view) => ({ ...view, kind: "cad" }))
  ];
  const activeGalleryItem = galleryItems.find((item) => item.id === selectedGalleryId) ?? galleryItems[0];

  function handleDiscuss() {
    onDiscuss(product, selectedWood);
  }

  return (
    <div className="product-modal" role="presentation" onMouseDown={onClose}>
      <div
        className="product-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`product-${product.id}-title`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" type="button" aria-label="Закрыть карточку товара" onClick={onClose}>
          <X size={19} />
        </button>
        <div className="product-sheet-header product-sheet-header-modal">
          <strong>Чайка</strong>
          <span>Product sheet<br />каркас лестницы</span>
          <em>{product.id}</em>
        </div>
        <div className="product-dialog-body">
          <div className="product-dialog-media">
            <div className="product-dialog-gallery" aria-label="Галерея ракурсов товара">
              <figure
                className={`product-gallery-panel product-gallery-main ${
                  activeGalleryItem.kind === "photo"
                    ? "product-photo-panel"
                    : activeGalleryItem.kind === "model"
                      ? "product-model-panel"
                      : "cad-gallery-panel"
                }`}
              >
                {activeGalleryItem.kind === "photo" ? (
                  <img src={activeGalleryItem.url} alt={product.title} />
                ) : activeGalleryItem.kind === "model" ? (
                  <Suspense fallback={<div className="product-modal-viewer model-viewer-loading">3D</div>}>
                    <ModelViewer3D
                      modelUrl={product.modelUrl || ""}
                      title={product.title}
                      settings={productModelSettings}
                      className="product-modal-viewer"
                    />
                  </Suspense>
                ) : (
                  <CadSketch viewId={activeGalleryItem.id} />
                )}
                <figcaption>
                  <strong>{activeGalleryItem.label}</strong>
                  <span>{activeGalleryItem.note}</span>
                </figcaption>
              </figure>

              <div className="product-gallery-thumbs" aria-label="Превью галереи">
                {galleryItems.map((item) => (
                  <button
                    className={item.id === selectedGalleryId ? "is-selected" : ""}
                    type="button"
                    key={item.id}
                    aria-pressed={item.id === selectedGalleryId}
                    onClick={() => setSelectedGalleryId(item.id)}
                  >
                    <span className="gallery-thumb-visual" aria-hidden="true">
                      {item.kind === "photo" ? (
                        <img src={item.url} alt="" />
                      ) : item.kind === "model" ? (
                        <span className="model-thumb-label">3D</span>
                      ) : (
                        <CadSketch viewId={item.id} />
                      )}
                    </span>
                    <strong>{item.label}</strong>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="product-dialog-copy">
            <span className="eyebrow">{product.type}</span>
            <h3 id={`product-${product.id}-title`}>{product.title}</h3>
            <p>{product.description}</p>
            <div className="product-spec-table product-spec-table-modal">
              {(product.specs || []).map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <ul>
              {(product.details || []).map((detail) => (
                <li key={detail}>
                  <Check size={16} />
                  {detail}
                </li>
              ))}
            </ul>
            <div className="wood-selector">
              <span className="wood-selector-title">Древесина для ступеней</span>
              <div className="wood-options">
                {woodOptions.map((wood) => (
                  <button
                    className={wood.id === selectedWoodId ? "is-selected" : ""}
                    type="button"
                    key={wood.id}
                    aria-pressed={wood.id === selectedWoodId}
                    onClick={() => setSelectedWoodId(wood.id)}
                  >
                    <span className="wood-preview" style={{ "--wood": wood.swatch }} aria-hidden="true" />
                    <strong>{wood.title}</strong>
                    <small>{wood.note}</small>
                  </button>
                ))}
              </div>
            </div>
            <button className="button primary product-discuss-button" type="button" onClick={handleDiscuss}>
              Обсудить модель
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SketchModelSection({ modelUrl, storedModel, settings }) {
  const model = sketchModels[0];
  const activeModelUrl = modelUrl || model.modelUrl;
  const viewerSettings = { ...settings, background: "white" };

  return (
    <section className="section model-section model-section-light theme-light" id="viewer3d">
      <div className="model-section-grid">
        <div className="model-copy reveal">
          <span className="eyebrow">3D просмотр</span>
          <h2>SketchUp-модель можно смотреть в браузере как интерактивный объект.</h2>
          <p>
            Для web-просмотра используем связку SketchUp → GLB → Three.js. GLB грузится быстро,
            вращается мышью или пальцем и подходит для карточек товаров.
          </p>
          <div className="model-meta">
            <span>{model.sourceFile}</span>
            <span>{storedModel ? formatFileSize(storedModel.size) : model.sourceSize}</span>
            <span>{model.format}</span>
          </div>
          <small>{model.note}</small>
        </div>
        <div className="reveal">
          <Suspense fallback={<div className="model-viewer-shell model-viewer-loading">Загрузка 3D viewer</div>}>
            <ModelViewer3D modelUrl={activeModelUrl} title={model.title} settings={viewerSettings} className="main-model-viewer" />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

function ReviewUploadSection() {
  const [reviewModel, setReviewModel] = useState(null);
  const [reviewSettings, setReviewSettings] = useState(productModelSettings);

  useEffect(() => {
    return () => {
      if (reviewModel?.url?.startsWith("blob:")) {
        URL.revokeObjectURL(reviewModel.url);
      }
    };
  }, [reviewModel]);

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const uploaded = await uploadReviewModelFile(file);
      setReviewModel({ ...uploaded, name: decodeUploadedName(uploaded.name || file.name) });
    } catch {
      setReviewModel((current) => {
        if (current?.url?.startsWith("blob:")) {
          URL.revokeObjectURL(current.url);
        }

        return {
          name: decodeUploadedName(file.name),
          size: file.size,
          url: URL.createObjectURL(file)
        };
      });
    }
  }

  function closeViewer() {
    setReviewModel((current) => {
      if (current?.url?.startsWith("blob:")) {
        URL.revokeObjectURL(current.url);
      }

      return null;
    });
  }

  function updateReviewSetting(name, value) {
    setReviewSettings((current) => ({ ...current, [name]: value }));
  }

  function setOutlineMode(mode) {
    setReviewSettings((current) => ({
      ...current,
      showLines: mode !== "none",
      lineColor: mode === "white" ? "white" : "dark"
    }));
  }

  function getOutlineMode() {
    if (!reviewSettings.showLines) {
      return "none";
    }

    return reviewSettings.lineColor === "white" ? "white" : "dark";
  }

  return (
    <section className="section review-upload theme-light" id="review-upload">
      <div className="review-upload-inner reveal">
        <div>
          <span className="eyebrow">Загрузить модель</span>
          <h2>Быстрый просмотр GLB для предварительного согласования</h2>
          <p>
            Загрузите файл модели, чтобы сразу открыть интерактивный просмотр: проверить форму, ракурс,
            масштаб и показать вариант заказчику до финального расчета.
          </p>
        </div>
        <label className="button primary review-upload-button">
          <Upload size={17} />
          Загрузить GLB
          <input type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" onChange={handleUpload} />
        </label>
      </div>

      {reviewModel ? (
        <div className="review-model-modal" role="presentation" onMouseDown={closeViewer}>
          <div className="review-model-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" aria-label="Закрыть просмотр" onClick={closeViewer}>
              <X size={19} />
            </button>
            <div className="review-model-header">
              <span>Предварительное согласование</span>
              <strong>{decodeUploadedName(reviewModel.name)}</strong>
              <em>{formatFileSize(reviewModel.size)}</em>
            </div>
            <div className="review-model-layout">
              <div className="review-model-stage">
                <Suspense fallback={<div className="model-viewer-shell model-viewer-loading">Загрузка 3D viewer</div>}>
                  <ModelViewer3D
                    modelUrl={reviewModel.url}
                    title={decodeUploadedName(reviewModel.name)}
                    settings={reviewSettings}
                    className="review-model-viewer"
                  />
                </Suspense>
              </div>
              <aside className="review-inspector" aria-label="Настройки 3D просмотра">
                <div className="review-inspector-section">
                  <div className="review-inspector-title">Контуры</div>
                  <div className="review-control-group review-control-stack">
                    {[
                      ["none", "Без"],
                      ["white", "Белый"],
                      ["dark", "Темный"]
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={getOutlineMode() === id}
                        onClick={() => setOutlineMode(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="review-inspector-section">
                  <button
                    className="review-shadow-button"
                    type="button"
                    aria-pressed={reviewSettings.shadows}
                    onClick={() => updateReviewSetting("shadows", !reviewSettings.shadows)}
                  >
                    Мягкие тени
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function OtherProductsSection({ items }) {
  return (
    <section className="section other-products theme-light" id="other-products">
      <SectionHeader
        eyebrow="Другие изделия"
        title="Производим не только лестницы"
        text="Отдельный раздел для смежных товаров: мебель из металла, элементы мебели, опоры, рамы и изделия по чертежам."
      />
      <div className="other-products-grid">
        {items.map((item) => (
          <article className="other-product-card reveal" key={item.id}>
            <span>{item.category || "металл"}</span>
            <h3>{item.title}</h3>
            <p>{item.description || item.excerpt}</p>
            <div className="tags">
              {(item.tags || []).map((tag) => (
                <small key={tag}>{tag}</small>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function NewsSection({ items }) {
  return (
    <section className="section news-section theme-dark" id="news" data-header-tone="dark">
      <SectionHeader
        eyebrow="Новости"
        title="Новости производства и обновления сайта"
        text="Здесь будут появляться короткие новости: новые модели, материалы, обновления 3D-просмотра и производственные заметки."
      />
      <div className="news-grid">
        {items.map((item) => (
          <article className="blog-card reveal" key={item.id}>
            <span>{item.publishedAt}</span>
            <h3>{item.title}</h3>
            <p>{item.excerpt}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function parseTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseLines(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseSpecsText(value) {
  return parseLines(value)
    .map((line) => {
      const [label, ...rest] = line.split(":");
      return [label?.trim(), rest.join(":").trim()];
    })
    .filter(([label, text]) => label && text);
}

function serializeSpecs(specs = []) {
  return specs.map(([label, value]) => `${label}: ${value}`).join("\n");
}

function productToDraft(product) {
  return {
    localId: product.id || `product-${Date.now()}`,
    id: product.id || `product-${Date.now()}`,
    title: product.title || "",
    type: product.type || "",
    cover: product.cover || "",
    description: product.description || "",
    modelUrl: product.modelUrl || "",
    specsText: serializeSpecs(product.specs || []),
    detailsText: (product.details || []).join("\n"),
    photosText: (product.photos || []).join("\n")
  };
}

function draftToProduct(draft) {
  return {
    id: draft.id.trim() || draft.localId,
    title: draft.title.trim() || "Новая модель",
    type: draft.type.trim(),
    cover: draft.cover.trim(),
    description: draft.description.trim(),
    modelUrl: draft.modelUrl.trim(),
    specs: parseSpecsText(draft.specsText),
    details: parseLines(draft.detailsText),
    photos: parseLines(draft.photosText)
  };
}

function ProductAdminPanel({ products, onSaveProduct, onStatus }) {
  const [drafts, setDrafts] = useState(() => products.map(productToDraft));

  useEffect(() => {
    setDrafts(products.map(productToDraft));
  }, [products]);

  function updateDraft(localId, field, value) {
    setDrafts((current) => current.map((draft) => (draft.localId === localId ? { ...draft, [field]: value } : draft)));
  }

  function addProduct() {
    const id = `product-${Date.now()}`;
    setDrafts((current) => [
      productToDraft({
        id,
        title: "Новая модель",
        type: "тип каркаса",
        cover: "",
        description: "",
        specs: [["Основа", ""]],
        details: []
      }),
      ...current
    ]);
  }

  async function submitProduct(event, draft) {
    event.preventDefault();
    const form = event.currentTarget;
    const files = {
      cover: form.elements.coverFile.files[0],
      photos: Array.from(form.elements.photosFile.files || []),
      model: form.elements.modelFile.files[0]
    };

    try {
      const savedProduct = await onSaveProduct(draftToProduct(draft), files);

      setDrafts((current) => current.map((item) => (item.localId === draft.localId ? productToDraft(savedProduct) : item)));
      form.reset();
      onStatus(`Карточка "${savedProduct.title}" сохранена.`);
    } catch {
      onStatus("Не удалось сохранить карточку. Проверьте вход в админку.");
    }
  }

  return (
    <div className="cms-product-editor">
      <div className="cms-product-editor-head">
        <h3>Карточки товаров</h3>
        <button className="button secondary" type="button" onClick={addProduct}>Добавить карточку</button>
      </div>
      <div className="cms-product-list">
        {drafts.map((draft) => (
          <form className="cms-product-card" key={draft.localId} onSubmit={(event) => submitProduct(event, draft)}>
            <div className="cms-product-card-head">
              <strong>{draft.title || "Новая модель"}</strong>
              <span>{draft.id}</span>
            </div>
            <div className="cms-product-fields">
              <label>
                ID
                <input value={draft.id} onChange={(event) => updateDraft(draft.localId, "id", event.target.value)} required />
              </label>
              <label>
                Название
                <input value={draft.title} onChange={(event) => updateDraft(draft.localId, "title", event.target.value)} required />
              </label>
              <label>
                Тип
                <input value={draft.type} onChange={(event) => updateDraft(draft.localId, "type", event.target.value)} />
              </label>
              <label>
                URL главного фото
                <input value={draft.cover} onChange={(event) => updateDraft(draft.localId, "cover", event.target.value)} />
              </label>
              <label>
                Главное фото
                <input name="coverFile" type="file" accept="image/*" />
              </label>
              <label>
                GLB / GLTF
                <input name="modelFile" type="file" accept=".glb,.gltf" />
              </label>
              <label className="cms-wide-field">
                Описание
                <textarea rows="3" value={draft.description} onChange={(event) => updateDraft(draft.localId, "description", event.target.value)} />
              </label>
              <label className="cms-wide-field">
                Характеристики: одна строка = Название: значение
                <textarea rows="4" value={draft.specsText} onChange={(event) => updateDraft(draft.localId, "specsText", event.target.value)} />
              </label>
              <label className="cms-wide-field">
                Маркеры: по одному в строке
                <textarea rows="4" value={draft.detailsText} onChange={(event) => updateDraft(draft.localId, "detailsText", event.target.value)} />
              </label>
              <label className="cms-wide-field">
                Дополнительные фото URL: по одному в строке
                <textarea rows="3" value={draft.photosText} onChange={(event) => updateDraft(draft.localId, "photosText", event.target.value)} />
              </label>
              <label>
                Загрузить дополнительные фото
                <input name="photosFile" type="file" accept="image/*" multiple />
              </label>
              <label>
                URL 3D файла
                <input value={draft.modelUrl} onChange={(event) => updateDraft(draft.localId, "modelUrl", event.target.value)} />
              </label>
            </div>
            <button className="button primary" type="submit">Сохранить карточку</button>
          </form>
        ))}
      </div>
    </div>
  );
}

function ContentAdminPanel({ isAuthorized, products, onLogin, onSaveProduct, onCreateBlog, onCreateNews, onCreateOtherProduct }) {
  const [status, setStatus] = useState("");

  async function submitLogin(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("");

    try {
      await onLogin({
        username: form.get("username"),
        password: form.get("password")
      });
      event.currentTarget.reset();
      setStatus("Вход выполнен.");
    } catch {
      setStatus("Неверный логин или пароль.");
    }
  }

  async function submitBlog(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await onCreateBlog({
      title: form.get("title"),
      city: form.get("city"),
      slug: form.get("slug"),
      excerpt: form.get("excerpt"),
      keywords: parseTags(form.get("keywords") || "")
    });

    event.currentTarget.reset();
    setStatus("Статья добавлена в блог.");
  }

  async function submitNews(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await onCreateNews({
      title: form.get("title"),
      excerpt: form.get("excerpt")
    });

    event.currentTarget.reset();
    setStatus("Новость добавлена.");
  }

  async function submitOtherProduct(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await onCreateOtherProduct({
      title: form.get("title"),
      description: form.get("description"),
      tags: parseTags(form.get("tags") || "")
    });

    event.currentTarget.reset();
    setStatus("Другой товар добавлен.");
  }

  async function handleSubmit(handler, event) {
    setStatus("");

    try {
      await handler(event);
    } catch {
      setStatus("API недоступен. Проверьте backend на порту 3001.");
    }
  }

  return (
    <section className="section cms-admin theme-light" id="cms-admin">
      <SectionHeader
        eyebrow="CMS"
        title="Админ-панель для наполнения сайта"
        text="Карточки товаров, статьи, новости и смежные товары сохраняются на backend в data/content.json."
      />
      {!isAuthorized ? (
        <form className="cms-login-card reveal" onSubmit={submitLogin}>
          <h3>Вход администратора</h3>
          <label>
            Логин
            <input name="username" autoComplete="username" defaultValue="admin" required />
          </label>
          <label>
            Пароль
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="button primary" type="submit">Войти</button>
          {status ? <p className="cms-admin-status">{status}</p> : null}
        </form>
      ) : (
        <>
          <ProductAdminPanel products={products} onSaveProduct={onSaveProduct} onStatus={setStatus} />
      <div className="cms-admin-grid reveal">
        <form className="cms-admin-card" onSubmit={(event) => handleSubmit(submitBlog, event)}>
          <h3>Статья блога</h3>
          <label>
            Город
            <input name="city" placeholder="Москва" />
          </label>
          <label>
            Заголовок
            <input name="title" placeholder="Каркас лестницы в Казани" required />
          </label>
          <label>
            URL slug
            <input name="slug" placeholder="karkas-lestnicy-kazan" />
          </label>
          <label>
            Краткое описание
            <textarea name="excerpt" rows="3" required />
          </label>
          <label>
            Ключевые слова
            <input name="keywords" placeholder="каркас лестницы, Казань, монокосоур" />
          </label>
          <button className="button primary" type="submit">Добавить статью</button>
        </form>

        <form className="cms-admin-card" onSubmit={(event) => handleSubmit(submitNews, event)}>
          <h3>Новость</h3>
          <label>
            Заголовок
            <input name="title" placeholder="Новая партия моделей" required />
          </label>
          <label>
            Текст
            <textarea name="excerpt" rows="6" required />
          </label>
          <button className="button primary" type="submit">Добавить новость</button>
        </form>

        <form className="cms-admin-card" onSubmit={(event) => handleSubmit(submitOtherProduct, event)}>
          <h3>Другой товар</h3>
          <label>
            Название
            <input name="title" placeholder="Каркасы столов" required />
          </label>
          <label>
            Описание
            <textarea name="description" rows="4" required />
          </label>
          <label>
            Теги
            <input name="tags" placeholder="столы, опоры, металл" />
          </label>
          <button className="button primary" type="submit">Добавить товар</button>
        </form>
      </div>
      {status ? <p className="cms-admin-status">{status}</p> : null}
        </>
      )}
    </section>
  );
}

export default function App() {
  const root = useRef(null);
  const hasServerModel = useRef(false);
  const [activeProduct, setActiveProduct] = useState(null);
  const [requestContext, setRequestContext] = useState(null);
  const [modelSettings, setModelSettings] = useState(readModelSettings);
  const [storedModel, setStoredModel] = useState(null);
  const [storedModelUrl, setStoredModelUrl] = useState("");
  const [cmsContent, setCmsContent] = useState(null);
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY) || "");

  const displayBlogPosts = cmsContent?.blog?.length ? cmsContent.blog : blogPosts;
  const displayNews = cmsContent?.news?.length ? cmsContent.news : fallbackNews;
  const displayOtherProducts = cmsContent?.otherProducts?.length ? cmsContent.otherProducts : fallbackOtherProducts;
  const displayProductModels = cmsContent?.products?.length ? cmsContent.products : productModels;

  useEffect(() => {
    if (!activeProduct) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setActiveProduct(null);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeProduct]);

  useEffect(() => {
    let isActive = true;

    getContent()
      .then((content) => {
        if (!isActive) {
          return;
        }

        setCmsContent(content);

        if (content.model?.settings) {
          setModelSettings((current) => ({ ...current, ...content.model.settings }));
        }

        if (content.model?.activeFile?.url) {
          hasServerModel.current = true;
          setStoredModel(content.model.activeFile);
          setStoredModelUrl(content.model.activeFile.url);
        }
      })
      .catch(() => {});

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    loadStoredModel()
      .then((record) => {
        if (!isActive || !record?.file) {
          return;
        }

        if (hasServerModel.current) {
          return;
        }

        setStoredModel(record);
        setStoredModelUrl(URL.createObjectURL(record.file));
      })
      .catch(() => {});

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(MODEL_SETTINGS_KEY, JSON.stringify(modelSettings));
  }, [modelSettings]);

  useEffect(() => {
    return () => {
      if (storedModelUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(storedModelUrl);
      }
    };
  }, [storedModelUrl]);

  function handleDiscussProduct(product, wood) {
    setRequestContext({ productTitle: product.title, woodTitle: wood.title });
    setActiveProduct(null);

    window.setTimeout(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.querySelector("#request")?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start"
      });
      window.history.replaceState(null, "", "#request");
    }, 80);
  }

  function addCmsEntry(key, entry) {
    setCmsContent((content) => ({
      ...content,
      [key]: [entry, ...(content?.[key] || [])]
    }));
  }

  async function handleCreateBlog(entry) {
    addCmsEntry("blog", await createBlogPost(entry, adminToken));
  }

  async function handleCreateNews(entry) {
    addCmsEntry("news", await createNewsItem(entry, adminToken));
  }

  async function handleCreateOtherProduct(entry) {
    addCmsEntry("otherProducts", await createOtherProduct(entry, adminToken));
  }

  async function handleAdminLogin(credentials) {
    const session = await loginAdmin(credentials);
    localStorage.setItem(ADMIN_TOKEN_KEY, session.token);
    setAdminToken(session.token);
  }

  async function handleSaveProduct(product, files) {
    const saved = await saveProduct(product, adminToken);
    const hasFiles = files.cover || files.model || files.photos?.length;
    const finalProduct = hasFiles ? await uploadProductAssets(saved.id, files, adminToken) : saved;

    setCmsContent((content) => {
      const currentProducts = content?.products?.length ? content.products : productModels;
      const exists = currentProducts.some((item) => item.id === finalProduct.id);
      const nextProducts = exists
        ? currentProducts.map((item) => (item.id === finalProduct.id ? finalProduct : item))
        : [finalProduct, ...currentProducts];

      return {
        ...content,
        products: nextProducts
      };
    });

    return finalProduct;
  }

  useGSAP(
    (context, contextSafe) => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduceMotion) {
        gsap.set(".reveal, .hero-copy > *, .hero-visual, .site-header", {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          filter: "none"
        });
        return;
      }

      gsap.defaults({ ease: "power3.out", duration: 0.84 });

      gsap
        .timeline()
        .from(".site-header", { autoAlpha: 0, y: -14, filter: "blur(10px)", duration: 0.56 })
        .fromTo(
          ".hero-copy > *",
          { autoAlpha: 0, y: 24, scale: 0.986, filter: "blur(14px)" },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            stagger: 0.07,
            clearProps: "opacity,visibility,transform,filter"
          },
          "-=0.18"
        )
        .fromTo(
          ".hero-visual",
          { autoAlpha: 0, y: 28, scale: 0.985, filter: "blur(14px)" },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            duration: 0.9,
            clearProps: "opacity,visibility,transform,filter"
          },
          "-=0.52"
        );

      gsap.to(".frame-scene", {
        y: -18,
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: 1
        }
      });

      const revealBatch = contextSafe((elements) => {
        gsap.fromTo(
          elements,
          { autoAlpha: 0, y: 30, scale: 0.986, filter: "blur(14px)" },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            stagger: 0.075,
            overwrite: true,
            clearProps: "opacity,visibility,transform,filter"
          }
        );
      });

      ScrollTrigger.batch(".reveal", {
        start: "top 84%",
        once: true,
        onEnter: revealBatch
      });
    },
    { scope: root }
  );

  return (
    <div className="app" ref={root}>
      <Header />

      <main id="top">
        <section className="hero theme-light">
          <div className="hero-copy">
            <span className="eyebrow">Каркас под ваш проем</span>
            <h1>Металлический каркас лестницы с точной заводской сборкой</h1>
            <p>
              Проектируем и изготавливаем каркасы из листовой стали на ЧПУ-оборудовании.
              Привозим готовый комплект с крепежом и схемой сборки. Можно установить
              самостоятельно или заказать монтаж нашей бригадой.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#request">
                Рассчитать каркас
                <ArrowRight size={18} />
              </a>
              <a className="button secondary" href="#gallery">Смотреть варианты</a>
            </div>
            <div className="benefit-list" aria-label="Преимущества">
              {heroBenefits.map((benefit) => (
                <span key={benefit}>
                  <Check size={16} />
                  {benefit}
                </span>
              ))}
            </div>
          </div>

          <div className="hero-visual" aria-label="Схема металлического каркаса лестницы">
            <div className="frame-scene photo-scene">
              <img src="/materials/hero-finished-stair.jpg" alt="Готовая лестница на металлокаркасе в частном доме" />
              <div className="scene-grid" />
              <div className="photo-shade" />
              <div className="scene-label label-a">реальный объект</div>
              <div className="scene-label label-b">каркас + ступени</div>
            </div>
          </div>
        </section>

        <section className="section product-section theme-light" id="models">
          <SectionHeader
            eyebrow="Модели"
            title="Товары, которые можно заложить в расчет"
            text="Пока базовая витрина. Позже сюда можно добавлять новые модели без изменения верстки."
          />
          <div className="product-rail-wrap reveal" aria-label="Горизонтальная лента товаров">
            <div className="product-rail">
              {displayProductModels.map((product, index) => (
                <article className="product-card" key={product.id}>
                  <div className="product-sheet-header">
                    <strong>Чайка</strong>
                    <span>Product sheet<br />модель каркаса</span>
                    <em>{String(index + 1).padStart(2, "0")} / {String(displayProductModels.length).padStart(2, "0")}</em>
                  </div>
                  <div className="product-card-title">
                    <span>{product.type}</span>
                    <h3>{product.title}</h3>
                  </div>
                  <div className="product-card-media">
                    <img src={product.cover || "/materials/work-render-frame.png"} alt={product.title} loading="lazy" />
                  </div>
                  <div className="product-spec-table">
                    {(product.specs || []).slice(0, 4).map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="product-card-footer">
                    <p>{product.description}</p>
                    <button type="button" onClick={() => setActiveProduct(product)}>
                      Открыть карточку
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <SketchModelSection
          modelUrl={storedModelUrl}
          storedModel={storedModel}
          settings={modelSettings}
        />

        <ReviewUploadSection />

        <section className="problem section theme-light compact-section">
          <div className="split">
            <div className="reveal">
              <span className="eyebrow">Проблема</span>
              <h2>Обычная сварка на объекте оставляет шум, искры, пыль и риск для отделки.</h2>
              <figure className="problem-photo">
                <img src="/materials/work-bare-frame.jpg" alt="Классический монтаж лестницы с подгонкой на объекте" loading="lazy" />
                <figcaption>классическая подгонка на объекте</figcaption>
              </figure>
            </div>
            <div className="reveal">
              <p>
                Мы переносим сложные работы в цех: сначала проект, затем резка, контрольная
                сборка и порошковая покраска. На объект приезжает готовый комплект, который
                собирается на крепеж без подгонки.
              </p>
            </div>
          </div>
        </section>

        <section className="section theme-light">
          <SectionHeader
            eyebrow="Кому подходит"
            title="Когда нужен предсказуемый результат, а не импровизация"
          />
          <div className="audience-grid">
            {audiences.map((item) => (
              <article className="text-card reveal" key={item}>
                <p>{item}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section theme-dark transition-band section-align-right" data-header-tone="dark">
          <SectionHeader
            eyebrow="Что входит"
            title="Лестницы «Чайка» - не просто металл, а готовая система"
            text="Комплект можно собрать самостоятельно по инструкции или передать монтаж нашей бригаде."
          />
          <div className="deliverables">
            {deliverables.map(([title, text]) => (
              <article className="deliverable reveal" key={title}>
                <span>{title}</span>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section theme-light" id="catalog">
          <SectionHeader
            eyebrow="Типы каркасов"
            title="Подбираем конструкцию под проем, стиль дома и бюджет"
            text="Возможные формы: прямой марш, Г-образная лестница, П-образная лестница, площадка или забежные ступени."
          />
          <div className="type-grid">
            {frameTypes.map(([title, text]) => (
              <article className="type-card reveal" key={title}>
                <Ruler size={20} />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section theme-light" id="gallery">
          <SectionHeader
            eyebrow="Галерея"
            title="Галерея работ"
            text="Реальные объекты и детали каркасов: готовые лестницы, комплекты, узлы и варианты ограждений."
          />
          <div className="gallery-grid">
            {workGalleries.map((item) => (
              <article className="gallery-card reveal" key={item.id}>
                <img src={item.cover} alt={item.title} loading="lazy" />
                <div>
                  <span className="location">
                    <MapPin size={15} />
                    {item.location}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <div className="tags">
                    {item.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section theme-dark transition-band section-align-right" id="process" data-header-tone="dark">
          <SectionHeader
            eyebrow="Как проходит работа"
            title="Цена, сроки и состав комплекта фиксируются до производства"
          />
          <div className="process-list">
            {processSteps.map(([title, text], index) => (
              <article className="process-step reveal" key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section theme-light">
          <SectionHeader
            eyebrow="Комплектации"
            title="Можно купить только каркас или заказать лестницу под ключ"
          />
          <div className="package-grid">
            {packages.map(([title, includes, fit]) => (
              <article className="package-card reveal" key={title}>
                <h3>{title}</h3>
                <p>{includes}</p>
                <span>{fit}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="section trust theme-light">
          <div className="split">
            <div className="reveal">
              <span className="eyebrow">Гарантии</span>
              <h2>Доверие строится на договоре, фотоотчетах и проверенной геометрии.</h2>
            </div>
            <div className="trust-list">
              {trustPoints.map((point) => (
                <p className="reveal" key={point}>
                  <ShieldCheck size={18} />
                  {point}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className="section geo theme-light">
          <SectionHeader
            eyebrow="География"
            title="Работаем по всей России"
            text="Предварительный расчет делаем удаленно: по фото, плану дома или размерам проема."
          />
          <div className="area-list reveal">
            {serviceAreas.map((area) => (
              <span key={area}>{area}</span>
            ))}
          </div>
        </section>

        <section className="section theme-dark transition-band" id="blog" data-header-tone="dark">
          <SectionHeader
            eyebrow="Geo SEO блог"
            title="Статьи под региональные запросы уже вынесены в отдельные данные"
            text="Структура рассчитана на страницы и темы по городам: Москва, Санкт-Петербург, Казань и другие регионы."
          />
          <div className="blog-grid">
            {displayBlogPosts.map((post) => (
              <article className="blog-card reveal" key={post.slug}>
                <span>{post.city}</span>
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                <div className="keywords">
                  {post.keywords.map((keyword) => (
                    <small key={keyword}>{keyword}</small>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <NewsSection items={displayNews} />

        <section className="section faq theme-light" id="faq">
          <SectionHeader
            eyebrow="FAQ"
            title="Коротко о расчете, сборке и монтаже"
            text="Ответы на вопросы, которые обычно появляются до заявки."
          />
          <div className="faq-grid">
            {faqItems.map((item) => (
              <details className="faq-item reveal" key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="section request theme-light" id="request">
          <div className="request-copy reveal">
            <span className="eyebrow">Расчет</span>
            <h2>Пришлите размеры, фото проема или план дома.</h2>
            <p>
              Покажем, какой тип каркаса подойдет, и подготовим предварительную стоимость.
              Канал связи выбираете сами: MAX, Telegram или почта.
            </p>
          </div>
          <LeadForm requestContext={requestContext} />
        </section>

        <OtherProductsSection items={displayOtherProducts} />
      </main>

      <footer className="footer" data-header-tone="dark">
        <div>
          <a className="footer-brand" href="#top">
            <img className="footer-logo" src="/materials/logo-chaika.png" alt="Лестницы Чайка" />
            <span>Лестницы Чайка</span>
          </a>
          <p>Металлические каркасы лестниц под проем. Производство, доставка и монтаж по России.</p>
        </div>
        <div className="footer-actions">
          <a className="footer-link footer-admin-button" href="/admin">
            Админ сайта
          </a>
          <a className="footer-link" href="#request">
            Обсудить проект
            <ArrowRight size={16} />
          </a>
        </div>
      </footer>
      <ProductModal
        product={activeProduct}
        onClose={() => setActiveProduct(null)}
        onDiscuss={handleDiscussProduct}
      />
      <ScrollToTopButton />
    </div>
  );
}
