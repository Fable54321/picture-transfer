const API_BASE_URL = import.meta.env.VITE_API_URL || "";

let refreshPromise: Promise<boolean> | null = null;
let sessionExpired = false;

type FetchWithAuthOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
};

async function refreshOnce(): Promise<boolean> {
  if (sessionExpired) return false;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) {
          sessionExpired = true;
        }
        return res.ok;
      })
      .catch(() => {
        sessionExpired = true;
        return false;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export function resetSessionExpiredFlag() {
  sessionExpired = false;
}

export async function fetchWithAuth<T>(
  path: string,
  options: FetchWithAuthOptions = {},
): Promise<T> {
  if (sessionExpired) {
    throw new Error("Session expirée, veuillez vous reconnecter.");
  }

  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const makeRequest = () => {
    const headers = new Headers(options.headers);
    let serializedBody: BodyInit | null | undefined;

   
    const body = options.body;

    const isPlainObject =
      body != null &&
      typeof body === "object" &&
      !(body instanceof FormData) &&
      !(body instanceof URLSearchParams) &&
      !(body instanceof Blob) &&
      !(body instanceof ArrayBuffer) &&
      !(body instanceof ReadableStream);

    if (isPlainObject) {
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      serializedBody = JSON.stringify(body);
    } else {
      serializedBody = body as BodyInit | null | undefined;
    }

    return fetch(url, {
      ...options,
      credentials: "include",
      headers,
      body: serializedBody,
    });
  };

  let response = await makeRequest();

  if (response.status === 401) {
    const refreshed = await refreshOnce();

    if (!refreshed) {
      alert("veuillez vous reconnecter.")
      window.location.replace("https://vegibec-portail.com/");
      throw new Error("Session expirée, veuillez vous reconnecter.");
    }

    response = await makeRequest();
  }

  if (!response.ok) {
    const requestMethod = (options.method?.toString().toUpperCase() || "GET");
    const requestRoute = url;
    let errorMessage = `HTTP error ${response.status} (${requestMethod} ${requestRoute})`;

    try {
      const data = await response.json();
      const userMessage = data.error || data.message;
      if (userMessage) {
        errorMessage = `${userMessage} (${requestMethod} ${requestRoute})`;
      }
    } catch {
      const text = await response.text();
      if (text) {
        errorMessage = `${text} (${requestMethod} ${requestRoute})`;
      }
    }

    if (response.status === 403) {
      console.warn(`[fetchWithAuth] 403 Forbidden at ${requestMethod} ${requestRoute}`, {
        status: response.status,
        message: errorMessage,
      });
      alert(`Accès refusé pour ${requestMethod} ${requestRoute}.\n${errorMessage}`);
      window.location.replace("https://vegibec-portail.com/");
      throw new Error(
        `Accès refusé : vous n'avez pas les permissions nécessaires. (${requestMethod} ${requestRoute})`,
      );
    }

    if (response.status === 500) {
      errorMessage = `Erreur serveur, veuillez réessayer plus tard. (${requestMethod} ${requestRoute})`;
    }

    throw new Error(errorMessage);
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }

  return null as T;
}
