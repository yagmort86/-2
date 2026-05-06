import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ArrowRight, ExternalLink, MessageCircle, Rotate3D, TriangleAlert } from "lucide-react";
import "./clientModel.css";

const ModelViewer3D = lazy(() =>
  import("./components/ModelViewer3D").then((module) => ({ default: module.ModelViewer3D }))
);

const viewerSettings = {
  cameraAngle: "axon",
  showLines: false,
  lineColor: "dark",
  softShadows: true,
  shadows: true,
  background: "transparent",
  autoRotate: true
};

function getTelegramApp() {
  return window.Telegram?.WebApp || null;
}

function loadTelegramScript() {
  if (window.Telegram?.WebApp) {
    return Promise.resolve();
  }

  const currentScript = document.querySelector("script[data-telegram-web-app]");
  if (currentScript) {
    return new Promise((resolve) => {
      currentScript.addEventListener("load", resolve, { once: true });
      currentScript.addEventListener("error", resolve, { once: true });
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js?62";
    script.async = true;
    script.dataset.telegramWebApp = "true";
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", resolve, { once: true });
    document.head.appendChild(script);
  });
}

function getMode() {
  if (window.location.pathname.startsWith("/client/")) {
    return "choice";
  }

  if (window.location.pathname.startsWith("/viewer/")) {
    return "browser";
  }

  return "telegram";
}

function getPathToken() {
  const match = window.location.pathname.match(/^\/(?:client|viewer)\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function getStartToken() {
  const params = new URLSearchParams(window.location.search);
  const telegramApp = getTelegramApp();

  return (
    telegramApp?.initDataUnsafe?.start_param ||
    params.get("tgWebAppStartParam") ||
    params.get("startapp") ||
    params.get("token") ||
    getPathToken()
  );
}

function buildAbsolutePath(path) {
  return new URL(path, window.location.origin).href;
}

function ClientModelFallback({ text }) {
  return (
    <div className="client-model-app client-model-state">
      <div>
        <Rotate3D size={30} />
        <p>{text}</p>
      </div>
    </div>
  );
}

function ClientModelError({ message }) {
  return (
    <div className="client-model-app client-model-state">
      <div>
        <TriangleAlert size={30} />
        <p>{message}</p>
      </div>
    </div>
  );
}

function ChoicePage({ link }) {
  return (
    <main className="client-model-app client-choice">
      <section className="client-choice-panel">
        <div className="client-choice-mark">
          <Rotate3D size={22} />
        </div>
        <span className="client-eyebrow">3D модель лестницы</span>
        <h1>{link.title}</h1>
        <p>Выберите, где открыть просмотр.</p>
        <div className="client-choice-actions">
          <a className="client-choice-button primary" href={link.telegramUrl}>
            <MessageCircle size={18} />
            Telegram
            <ArrowRight size={17} />
          </a>
          <a className="client-choice-button" href={link.browserPath}>
            <ExternalLink size={18} />
            Браузер
            <ArrowRight size={17} />
          </a>
        </div>
      </section>
    </main>
  );
}

function ViewerPage({ link, mode }) {
  const browserHref = buildAbsolutePath(link.browserPath);

  function openBrowser(event) {
    const telegramApp = getTelegramApp();

    if (!telegramApp?.openLink) {
      return;
    }

    event.preventDefault();
    telegramApp.openLink(browserHref);
  }

  return (
    <main className={`client-model-app client-model-viewer is-${mode}`}>
      <Suspense fallback={<ClientModelFallback text="Загрузка 3D" />}>
        <ModelViewer3D
          modelUrl={link.modelUrl}
          title={link.title}
          settings={viewerSettings}
          className="client-viewer-model"
        />
      </Suspense>

      <header className="client-viewer-top">
        <span className="client-eyebrow">{mode === "telegram" ? "Telegram Mini App" : "Браузерный просмотр"}</span>
        <h1>{link.title}</h1>
      </header>

      <footer className="client-viewer-bottom">
        {mode === "telegram" ? (
          <a href={browserHref} onClick={openBrowser}>
            Открыть в браузере
            <ExternalLink size={16} />
          </a>
        ) : (
          <a href={link.telegramUrl}>
            Открыть в Telegram
            <MessageCircle size={16} />
          </a>
        )}
      </footer>
    </main>
  );
}

export default function ClientModelApp() {
  const mode = useMemo(getMode, []);
  const token = useMemo(getStartToken, []);
  const [link, setLink] = useState(null);
  const [status, setStatus] = useState(token ? "loading" : "missing");

  useEffect(() => {
    if (mode !== "telegram") {
      return;
    }

    loadTelegramScript().then(() => {
      const telegramApp = getTelegramApp();
      telegramApp?.ready?.();
      telegramApp?.expand?.();
    });
  }, [mode]);

  useEffect(() => {
    if (!token) {
      return;
    }

    fetch(`/api/client-links/${encodeURIComponent(token)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("not-found");
        }

        return response.json();
      })
      .then((data) => {
        setLink(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [token]);

  if (status === "missing") {
    return <ClientModelError message="Ссылка без токена модели." />;
  }

  if (status === "error") {
    return <ClientModelError message="Модель по этой ссылке не найдена." />;
  }

  if (!link) {
    return <ClientModelFallback text="Загрузка модели" />;
  }

  return mode === "choice" ? <ChoicePage link={link} /> : <ViewerPage link={link} mode={mode} />;
}
