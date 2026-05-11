import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import "../App.css";

type UploadedPicture = {
  key: string;
  file_name: string;
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
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
    const body = (await response.json()) as { error?: string };
    return body.error || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

function App() {
  const [pictures, setPictures] = useState<UploadedPicture[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
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
      const response = await fetch(`${PICTURE_TRANSFER_URL}?limit=100`);

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = (await response.json()) as ListPicturesResponse;
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

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("pictures", file));

    setIsUploading(true);
    setError("");
    setStatus("");

    try {
      const response = await fetch(PICTURE_TRANSFER_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = (await response.json()) as UploadPicturesResponse;
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
      const response = await fetch(
        `${PICTURE_TRANSFER_URL}/download-url?key=${encodeURIComponent(
          picture.key,
        )}`,
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = (await response.json()) as {
        key: string;
        download_url: string;
      };

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
          <h1>Upload and download pictures</h1>
        </div>
        <button className="secondary-button" type="button" onClick={loadPictures}>
          Refresh
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
          <span className="drop-title">Choose pictures</span>
          <span className="drop-copy">
            Up to 50 image files, 250 MB each.
          </span>
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
            disabled={isUploading || selectedFiles.length === 0}
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
