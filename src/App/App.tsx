import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import "../App.css";

type UploadedPicture = {
  key: string;
  file_name: string;
  description?: string;
  content_type?: string;
  size_bytes: number;
  uploaded_at?: string;
  view_url: string;
  download_url: string;
};

type ListPicturesResponse = {
  pictures: UploadedPicture[];
  next_continuation_token: string | null;
  is_truncated: boolean;
};

type UploadPicturesResponse = {
  message: string;
  pictures: UploadedPicture[];
};

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";
const PICTURE_TRANSFER_URL = `${API_BASE_URL}/picture-transfer`;

const formatBytes = (bytes: number) => {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${
    units[exponent]
  }`;
};

const getErrorMessage = async (response: Response) => {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return (
      body.error ||
      body.message ||
      `Request failed with status ${response.status}`
    );
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

const requestJson = async <T,>(
  url: string,
  options: RequestInit = {},
): Promise<T> => {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return response.json() as Promise<T>;
};

function App() {
  const [pictures, setPictures] = useState<UploadedPicture[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const selectedSize = useMemo(
    () => selectedFiles.reduce((total, file) => total + file.size, 0),
    [selectedFiles],
  );

  const loadPictures = async () => {
    setIsLoading(true);
    setError("");

    try {
      const data = await requestJson<ListPicturesResponse>(
        `${PICTURE_TRANSFER_URL}?limit=100`,
      );
      setPictures(data.pictures);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load pictures",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPictures();
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(Array.from(event.target.files ?? []));
    setStatus("");
    setError("");
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedFiles.length === 0) {
      setError("Choose at least one picture to upload.");
      return;
    }

    const trimmedDescription = description.trim();

    if (!trimmedDescription) {
      setError("Add a description before uploading.");
      return;
    }

    const formData = new FormData();
    formData.append("description", trimmedDescription);
    selectedFiles.forEach((file) => formData.append("pictures", file));

    setIsUploading(true);
    setError("");
    setStatus("");

    try {
      const data = await requestJson<UploadPicturesResponse>(
        PICTURE_TRANSFER_URL,
        {
          method: "POST",
          body: formData,
        },
      );

      setPictures((currentPictures) => [
        ...data.pictures,
        ...currentPictures.filter(
          (picture) =>
            !data.pictures.some(
              (uploadedPicture) => uploadedPicture.key === picture.key,
            ),
        ),
      ]);
      setSelectedFiles([]);
      setDescription("");
      setStatus(data.message);

      const fileInput = event.currentTarget.elements.namedItem(
        "pictures",
      ) as HTMLInputElement | null;
      if (fileInput) {
        fileInput.value = "";
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to upload pictures",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const refreshDownloadUrl = async (picture: UploadedPicture) => {
    try {
      const data = await requestJson<{
        key: string;
        download_url: string;
      }>(
        `${PICTURE_TRANSFER_URL}/download-url?key=${encodeURIComponent(
          picture.key,
        )}`,
      );

      setPictures((currentPictures) =>
        currentPictures.map((currentPicture) =>
          currentPicture.key === data.key
            ? { ...currentPicture, download_url: data.download_url }
            : currentPicture,
        ),
      );

      window.location.href = data.download_url;
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to create download URL",
      );
    }
  };

  return (
    <main className="app-shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">Picture Transfer</p>
          <h1>Subir y descargar fotos</h1>
        </div>
        <button className="secondary-button" type="button" onClick={loadPictures}>
         actualizar
        </button>
      </section>

      <form className="upload-panel" onSubmit={handleUpload}>
        <label className="drop-zone">
          <input
            accept="image/*,.avif,.bmp,.gif,.heic,.heif,.jpeg,.jpg,.png,.tif,.tiff,.webp"
            multiple
            name="pictures"
            onChange={handleFileChange}
            type="file"
          />
          <span className="drop-title">seleccionar fotos</span>
          <span className="drop-copy">
            hasta 50 archivos de imagen
          </span>
        </label>

        <label className="description-field">
          <span>Description</span>
          <textarea
            maxLength={500}
            name="description"
            onChange={(event) => {
              setDescription(event.target.value);
              setStatus("");
              setError("");
            }}
            placeholder="Add a short description for this upload"
            required
            rows={4}
            value={description}
          />
        </label>

        <div className="upload-actions">
          <div>
            <strong>
              {selectedFiles.length === 0
                ? "No files selected"
                : `${selectedFiles.length} selected`}
            </strong>
            {selectedFiles.length > 0 && <span>{formatBytes(selectedSize)}</span>}
          </div>
          <button
            className="primary-button"
            disabled={
              isUploading ||
              selectedFiles.length === 0 ||
              description.trim().length === 0
            }
            type="submit"
          >
            {isUploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </form>

      {error && <p className="notice error">{error}</p>}
      {status && <p className="notice success">{status}</p>}

      <section className="picture-section">
        <div className="section-heading">
          <h2>Pictures</h2>
          <span>{pictures.length} available</span>
        </div>

        {isLoading ? (
          <p className="empty-state">Loading pictures...</p>
        ) : pictures.length === 0 ? (
          <p className="empty-state">No pictures have been uploaded yet.</p>
        ) : (
          <div className="picture-grid">
            {pictures.map((picture) => (
              <article className="picture-card" key={picture.key}>
                <a href={picture.view_url} rel="noreferrer" target="_blank">
                  <img alt={picture.file_name} src={picture.view_url} />
                </a>
                <div className="picture-meta">
                  <strong title={picture.file_name}>{picture.file_name}</strong>
                  {picture.description && (
                    <p title={picture.description}>{picture.description}</p>
                  )}
                  <span>
                    {formatBytes(picture.size_bytes)}
                    {picture.uploaded_at
                      ? ` - ${new Date(picture.uploaded_at).toLocaleString()}`
                      : ""}
                  </span>
                </div>
                <div className="picture-actions">
                  <a
                    className="secondary-button"
                    href={picture.view_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View
                  </a>
                  <button
                    className="primary-button"
                    onClick={() => void refreshDownloadUrl(picture)}
                    type="button"
                  >
                    Download
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
