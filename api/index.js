import app from "../server/index.js";

export default function handler(req, res) {
  const apiPath = req.query?.__path;

  if (apiPath) {
    const path = Array.isArray(apiPath) ? apiPath.join("/") : apiPath;
    const params = new URLSearchParams(req.query);
    params.delete("__path");
    const query = params.toString();

    req.url = `/api/${path}${query ? `?${query}` : ""}`;
  }

  return app(req, res);
}
