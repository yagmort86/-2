import { useEffect, useMemo, useState } from "react";
import { useCreate, useDelete, useLogin, useLogout, useOne, useShow, useUpdate } from "@refinedev/core";
import {
  CreateButton,
  DeleteButton,
  EditButton,
  List,
  ShowButton,
  useDataGrid
} from "@refinedev/mui";
import { DataGrid } from "@mui/x-data-grid";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography
} from "@mui/material";
import { useNavigate, useParams } from "react-router";
import { clearModel, createClientLink, getModel, updateModel, uploadModel, uploadProductAssets } from "./providers";

const resourceTitles = {
  products: "Товары",
  blog: "Блог",
  news: "Новости",
  "other-products": "Другие изделия"
};

const emptyDrafts = {
  products: {
    id: "",
    title: "",
    type: "",
    cover: "",
    description: "",
    modelUrl: "",
    specsText: "",
    detailsText: "",
    photosText: ""
  },
  blog: {
    title: "",
    city: "",
    slug: "",
    excerpt: "",
    publishedAt: "",
    keywordsText: ""
  },
  news: {
    title: "",
    excerpt: "",
    publishedAt: ""
  },
  "other-products": {
    title: "",
    description: "",
    excerpt: "",
    publishedAt: "",
    tagsText: ""
  }
};

const cameraAngles = [
  { id: "axon", label: "Изометрия" },
  { id: "side", label: "Сбоку" },
  { id: "front", label: "Фасад" },
  { id: "top", label: "Сверху" }
];

function linesToArray(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function arrayToLines(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function specsToText(specs) {
  return Array.isArray(specs) ? specs.map(([label, value]) => `${label}: ${value}`).join("\n") : "";
}

function textToSpecs(value) {
  return linesToArray(value)
    .map((line) => {
      const separator = line.indexOf(":");
      return separator === -1
        ? null
        : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    })
    .filter((row) => row?.[0] && row?.[1]);
}

function recordToDraft(resource, record) {
  if (!record) {
    return emptyDrafts[resource];
  }

  if (resource === "products") {
    return {
      id: record.id || "",
      title: record.title || "",
      type: record.type || "",
      cover: record.cover || "",
      description: record.description || "",
      modelUrl: record.modelUrl || "",
      specsText: specsToText(record.specs),
      detailsText: arrayToLines(record.details),
      photosText: arrayToLines(record.photos)
    };
  }

  if (resource === "blog") {
    return {
      title: record.title || "",
      city: record.city || "",
      slug: record.slug || "",
      excerpt: record.excerpt || "",
      publishedAt: record.publishedAt || "",
      keywordsText: arrayToLines(record.keywords)
    };
  }

  if (resource === "other-products") {
    return {
      title: record.title || "",
      description: record.description || "",
      excerpt: record.excerpt || "",
      publishedAt: record.publishedAt || "",
      tagsText: arrayToLines(record.tags)
    };
  }

  return {
    title: record.title || "",
    excerpt: record.excerpt || "",
    publishedAt: record.publishedAt || ""
  };
}

function draftToRecord(resource, draft) {
  if (resource === "products") {
    return {
      id: draft.id,
      title: draft.title,
      type: draft.type,
      cover: draft.cover,
      description: draft.description,
      modelUrl: draft.modelUrl,
      specs: textToSpecs(draft.specsText),
      details: linesToArray(draft.detailsText),
      photos: linesToArray(draft.photosText)
    };
  }

  if (resource === "blog") {
    return {
      title: draft.title,
      city: draft.city,
      slug: draft.slug,
      excerpt: draft.excerpt,
      publishedAt: draft.publishedAt,
      keywords: linesToArray(draft.keywordsText)
    };
  }

  if (resource === "other-products") {
    return {
      title: draft.title,
      description: draft.description,
      excerpt: draft.excerpt || draft.description,
      publishedAt: draft.publishedAt,
      tags: linesToArray(draft.tagsText)
    };
  }

  return {
    title: draft.title,
    excerpt: draft.excerpt,
    publishedAt: draft.publishedAt
  };
}

function ActionsCell({ resource, id }) {
  return (
    <Stack direction="row" spacing={1}>
      <ShowButton hideText size="small" resource={resource} recordItemId={id} />
      <EditButton hideText size="small" resource={resource} recordItemId={id} />
      <DeleteButton hideText size="small" resource={resource} recordItemId={id} />
    </Stack>
  );
}

function ProductCover({ value }) {
  if (!value) {
    return <span className="admin-muted">нет</span>;
  }

  return <img className="admin-thumb" src={value} alt="" loading="lazy" />;
}

function tagsCell(params) {
  const tags = Array.isArray(params.value) ? params.value : [];

  return (
    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
      {tags.slice(0, 3).map((tag) => (
        <Chip key={tag} label={tag} size="small" />
      ))}
    </Stack>
  );
}

function getColumns(resource) {
  const actions = {
    field: "actions",
    headerName: "",
    sortable: false,
    filterable: false,
    width: 132,
    renderCell: (params) => <ActionsCell resource={resource} id={params.id} />
  };

  if (resource === "products") {
    return [
      { field: "cover", headerName: "Фото", width: 92, sortable: false, filterable: false, renderCell: (params) => <ProductCover value={params.value} /> },
      { field: "title", headerName: "Название", flex: 1, minWidth: 220 },
      { field: "type", headerName: "Тип", width: 180 },
      { field: "description", headerName: "Описание", flex: 1, minWidth: 260 },
      actions
    ];
  }

  if (resource === "blog") {
    return [
      { field: "title", headerName: "Заголовок", flex: 1, minWidth: 260 },
      { field: "city", headerName: "Город", width: 160 },
      { field: "slug", headerName: "Slug", width: 220 },
      { field: "publishedAt", headerName: "Дата", width: 130 },
      actions
    ];
  }

  if (resource === "other-products") {
    return [
      { field: "title", headerName: "Название", flex: 1, minWidth: 240 },
      { field: "description", headerName: "Описание", flex: 1, minWidth: 280 },
      { field: "tags", headerName: "Теги", width: 260, sortable: false, renderCell: tagsCell },
      actions
    ];
  }

  return [
    { field: "title", headerName: "Заголовок", flex: 1, minWidth: 280 },
    { field: "excerpt", headerName: "Текст", flex: 1, minWidth: 320 },
    { field: "publishedAt", headerName: "Дата", width: 130 },
    actions
  ];
}

export function ResourceList({ resource }) {
  const { dataGridProps } = useDataGrid({
    resource,
    pagination: {
      pageSize: 25
    }
  });
  const columns = useMemo(() => getColumns(resource), [resource]);

  return (
    <List
      title={resourceTitles[resource]}
      headerButtons={() => <CreateButton resource={resource}>Добавить</CreateButton>}
    >
      <DataGrid
        {...dataGridProps}
        columns={columns}
        autoHeight
        disableRowSelectionOnClick
        getRowHeight={resource === "products" ? () => 76 : undefined}
        pageSizeOptions={[10, 25, 50, 100]}
      />
    </List>
  );
}

function Field({ label, name, draft, onChange, multiline = false, rows = 3, required = false, disabled = false }) {
  return (
    <TextField
      label={label}
      value={draft[name] || ""}
      onChange={(event) => onChange(name, event.target.value)}
      multiline={multiline}
      rows={multiline ? rows : undefined}
      required={required}
      disabled={disabled}
      fullWidth
    />
  );
}

function ResourceFields({ resource, draft, onChange, mode }) {
  if (resource === "products") {
    return (
      <>
        <Field label="ID" name="id" draft={draft} onChange={onChange} disabled={mode === "edit"} />
        <Field label="Название" name="title" draft={draft} onChange={onChange} required />
        <Field label="Тип" name="type" draft={draft} onChange={onChange} />
        <Field label="Главное фото URL" name="cover" draft={draft} onChange={onChange} />
        <Field label="Описание" name="description" draft={draft} onChange={onChange} multiline rows={4} />
        <Field label="Характеристики: строка = Название: значение" name="specsText" draft={draft} onChange={onChange} multiline rows={5} />
        <Field label="Маркеры: по одному в строке" name="detailsText" draft={draft} onChange={onChange} multiline rows={4} />
        <Field label="Дополнительные фото URL: по одному в строке" name="photosText" draft={draft} onChange={onChange} multiline rows={4} />
        <Field label="3D модель URL" name="modelUrl" draft={draft} onChange={onChange} />
      </>
    );
  }

  if (resource === "blog") {
    return (
      <>
        <Field label="Заголовок" name="title" draft={draft} onChange={onChange} required />
        <Field label="Город" name="city" draft={draft} onChange={onChange} />
        <Field label="Slug" name="slug" draft={draft} onChange={onChange} />
        <Field label="Краткое описание" name="excerpt" draft={draft} onChange={onChange} multiline rows={5} required />
        <Field label="Дата" name="publishedAt" draft={draft} onChange={onChange} />
        <Field label="Ключевые слова: по одному в строке" name="keywordsText" draft={draft} onChange={onChange} multiline rows={4} />
      </>
    );
  }

  if (resource === "other-products") {
    return (
      <>
        <Field label="Название" name="title" draft={draft} onChange={onChange} required />
        <Field label="Описание" name="description" draft={draft} onChange={onChange} multiline rows={5} required />
        <Field label="Краткий текст" name="excerpt" draft={draft} onChange={onChange} multiline rows={3} />
        <Field label="Дата" name="publishedAt" draft={draft} onChange={onChange} />
        <Field label="Теги: по одному в строке" name="tagsText" draft={draft} onChange={onChange} multiline rows={4} />
      </>
    );
  }

  return (
    <>
      <Field label="Заголовок" name="title" draft={draft} onChange={onChange} required />
      <Field label="Текст" name="excerpt" draft={draft} onChange={onChange} multiline rows={7} required />
      <Field label="Дата" name="publishedAt" draft={draft} onChange={onChange} />
    </>
  );
}

function ProductUploads({ onChange }) {
  return (
    <Paper className="admin-upload-panel" variant="outlined">
      <Typography variant="subtitle1">Файлы товара</Typography>
      <Stack spacing={2}>
        <Button variant="outlined" component="label">
          Главное фото
          <input hidden type="file" accept="image/*" onChange={(event) => onChange("cover", event.target.files?.[0] || null)} />
        </Button>
        <Button variant="outlined" component="label">
          Галерея
          <input hidden type="file" accept="image/*" multiple onChange={(event) => onChange("photos", event.target.files || [])} />
        </Button>
        <Button variant="outlined" component="label">
          GLB / GLTF
          <input hidden type="file" accept=".glb,.gltf" onChange={(event) => onChange("model", event.target.files?.[0] || null)} />
        </Button>
      </Stack>
    </Paper>
  );
}

export function ResourceForm({ resource, mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(emptyDrafts[resource]);
  const [files, setFiles] = useState({});
  const [error, setError] = useState("");
  const { query } = useOne({
    resource,
    id,
    queryOptions: {
      enabled: mode === "edit" && Boolean(id)
    }
  });
  const { mutate: create, mutation: createMutation } = useCreate();
  const { mutate: update, mutation: updateMutation } = useUpdate();
  const busy = Boolean(createMutation?.isPending || createMutation?.isLoading || updateMutation?.isPending || updateMutation?.isLoading);

  useEffect(() => {
    if (mode === "edit" && query.data?.data) {
      setDraft(recordToDraft(resource, query.data.data));
    }
  }, [mode, query.data, resource]);

  function updateField(name, value) {
    setDraft((current) => ({
      ...current,
      [name]: value
    }));
  }

  function updateFile(name, value) {
    setFiles((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function afterSave(record) {
    if (resource === "products" && (files.cover || files.model || files.photos?.length)) {
      await uploadProductAssets(record.id, files);
    }

    navigate(`/${resource}`);
  }

  function submit(event) {
    event.preventDefault();
    setError("");

    const values = draftToRecord(resource, draft);
    const options = {
      onSuccess: ({ data }) => {
        afterSave(data).catch(() => setError("Запись сохранена, но файлы не загрузились."));
      },
      onError: () => setError("Не удалось сохранить запись.")
    };

    if (mode === "edit") {
      update({ resource, id, values }, options);
      return;
    }

    create({ resource, values }, options);
  }

  return (
    <Box component="form" className="admin-form" onSubmit={submit}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="flex-start">
        <Paper className="admin-form-panel" variant="outlined">
          <Stack spacing={2.5}>
            <Typography variant="h5">{mode === "edit" ? "Редактировать" : "Добавить"}: {resourceTitles[resource]}</Typography>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <ResourceFields resource={resource} draft={draft} onChange={updateField} mode={mode} />
            <Stack direction="row" spacing={1.5}>
              <Button type="submit" variant="contained" disabled={busy}>
                Сохранить
              </Button>
              <Button type="button" variant="outlined" onClick={() => navigate(`/${resource}`)}>
                Отмена
              </Button>
            </Stack>
          </Stack>
        </Paper>
        {resource === "products" ? <ProductUploads onChange={updateFile} /> : null}
      </Stack>
    </Box>
  );
}

export function ResourceShow({ resource }) {
  const { id } = useParams();
  const { query } = useShow({ resource, id });
  const record = query.data?.data;
  const { mutate: remove } = useDelete();
  const navigate = useNavigate();

  if (query.isLoading) {
    return <Typography>Загрузка...</Typography>;
  }

  if (!record) {
    return <Alert severity="warning">Запись не найдена.</Alert>;
  }

  return (
    <Paper className="admin-show-panel" variant="outlined">
      <Stack spacing={2}>
        <Typography variant="h5">{record.title}</Typography>
        {Object.entries(record).map(([key, value]) => (
          <Box className="admin-show-row" key={key}>
            <Typography variant="caption">{key}</Typography>
            <Typography component="pre">{Array.isArray(value) || typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "")}</Typography>
          </Box>
        ))}
        <Stack direction="row" spacing={1.5}>
          <Button variant="contained" onClick={() => navigate(`/${resource}/edit/${record.id}`)}>
            Редактировать
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => remove({ resource, id: record.id }, { onSuccess: () => navigate(`/${resource}`) })}
          >
            Удалить
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

export function LoginPage() {
  const [credentials, setCredentials] = useState({ username: "admin", password: "" });
  const [error, setError] = useState("");
  const { mutate: login, mutation } = useLogin();

  function submit(event) {
    event.preventDefault();
    setError("");
    login(credentials, {
      onError: () => setError("Неверный логин или пароль.")
    });
  }

  return (
    <Box className="admin-login-page">
      <Paper className="admin-login-card" variant="outlined">
        <Stack spacing={2.5} component="form" onSubmit={submit}>
          <Box>
            <Typography variant="overline">Лестницы Чайка</Typography>
            <Typography variant="h4">Админ-панель</Typography>
          </Box>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField
            label="Логин"
            value={credentials.username}
            onChange={(event) => setCredentials((current) => ({ ...current, username: event.target.value }))}
            autoComplete="username"
            required
            fullWidth
          />
          <TextField
            label="Пароль"
            type="password"
            value={credentials.password}
            onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
            autoComplete="current-password"
            required
            fullWidth
          />
          <Button type="submit" variant="contained" disabled={Boolean(mutation?.isPending || mutation?.isLoading)}>
            Войти
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

export function ModelPage() {
  const [model, setModel] = useState(null);
  const [status, setStatus] = useState("");
  const [clientTitle, setClientTitle] = useState("");
  const [clientLink, setClientLink] = useState(null);

  useEffect(() => {
    getModel().then(setModel).catch(() => setStatus("Не удалось загрузить модель."));
  }, []);

  function updateSetting(name, value) {
    const nextSettings = {
      ...model.settings,
      [name]: value
    };

    setModel((current) => ({
      ...current,
      settings: nextSettings
    }));

    updateModel(nextSettings)
      .then(setModel)
      .catch(() => setStatus("Не удалось сохранить настройки."));
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      setModel(await uploadModel(file));
      setStatus("Модель загружена.");
    } catch {
      setStatus("Не удалось загрузить GLB/GLTF.");
    }
  }

  async function clear() {
    try {
      setModel(await clearModel());
      setStatus("Модель удалена.");
    } catch {
      setStatus("Не удалось удалить модель.");
    }
  }

  async function createLink() {
    if (!model.activeFile?.url) {
      setStatus("Сначала загрузите GLB/GLTF модель.");
      return;
    }

    try {
      const link = await createClientLink({
        title: clientTitle || model.activeFile.name,
        modelUrl: model.activeFile.url
      });
      setClientLink(`${window.location.origin}${link.publicPath}`);
      setStatus("Ссылка для клиента создана.");
    } catch {
      setStatus("Не удалось создать клиентскую ссылку.");
    }
  }

  if (!model) {
    return <Typography>Загрузка...</Typography>;
  }

  return (
    <Paper className="admin-form-panel" variant="outlined">
      <Stack spacing={2.5}>
        <Typography variant="h5">3D-модель на главном блоке</Typography>
        {status ? <Alert severity={status.includes("Не удалось") || status.includes("Сначала") ? "error" : "success"}>{status}</Alert> : null}
        <Box className="admin-model-file">
          <Typography variant="caption">Активный файл</Typography>
          <Typography>{model.activeFile?.name || "Не загружен"}</Typography>
          {model.activeFile?.url ? <Typography variant="body2">{model.activeFile.url}</Typography> : null}
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="contained" component="label">
            Загрузить GLB / GLTF
            <input hidden type="file" accept=".glb,.gltf" onChange={upload} />
          </Button>
          <Button variant="outlined" color="error" onClick={clear}>
            Удалить
          </Button>
        </Stack>
        <Stack spacing={1.5}>
          <Typography variant="subtitle1">Ссылка клиенту</Typography>
          <TextField
            label="Название проекта"
            value={clientTitle}
            onChange={(event) => setClientTitle(event.target.value)}
            placeholder={model.activeFile?.name || "Лестница клиента"}
          />
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" onClick={createLink}>
              Создать ссылку выбора
            </Button>
            {clientLink ? (
              <Button variant="text" onClick={() => navigator.clipboard?.writeText(clientLink)}>
                Скопировать
              </Button>
            ) : null}
          </Stack>
          {clientLink ? <Typography variant="body2">{clientLink}</Typography> : null}
        </Stack>
        <Stack spacing={1}>
          <Typography variant="subtitle1">Ракурс</Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {cameraAngles.map((angle) => (
              <Button
                variant={model.settings?.cameraAngle === angle.id ? "contained" : "outlined"}
                key={angle.id}
                onClick={() => updateSetting("cameraAngle", angle.id)}
              >
                {angle.label}
              </Button>
            ))}
          </Stack>
        </Stack>
        <Stack spacing={1}>
          <FormControlLabel
            control={<Switch checked={Boolean(model.settings?.showLines)} onChange={(event) => updateSetting("showLines", event.target.checked)} />}
            label="Показывать линии граней"
          />
          <FormControlLabel
            control={<Switch checked={Boolean(model.settings?.shadows)} onChange={(event) => updateSetting("shadows", event.target.checked)} />}
            label="Мягкие тени"
          />
        </Stack>
      </Stack>
    </Paper>
  );
}

export function AdminHeader() {
  const { mutate: logout } = useLogout();

  return (
    <Box className="admin-topbar">
      <Box>
        <Typography variant="overline">CMS</Typography>
        <Typography variant="h6">Металлокаркасы лестниц</Typography>
      </Box>
      <Stack direction="row" spacing={1}>
        <Button href="/" variant="outlined">
          На сайт
        </Button>
        <Button variant="contained" onClick={() => logout()}>
          Выйти
        </Button>
      </Stack>
    </Box>
  );
}
