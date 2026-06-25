// Backend API ile iletişim için basit yardımcı katman.
// Temel URL `.env.local` içindeki NEXT_PUBLIC_API_URL değerinden okunur.

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  token?: string | null;
  // JSON gövde (FormData ile aynı anda kullanılmaz)
  json?: unknown;
  // Dosya yükleme gibi durumlar için ham gövde
  body?: BodyInit;
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail) && data.detail[0]?.msg) {
      return data.detail[0].msg;
    }
  } catch {
    // gövde JSON değilse aşağıdaki varsayılana düş
  }
  return `İstek başarısız oldu (HTTP ${res.status}).`;
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", token, json, body } = options;
  const headers = new Headers();

  if (token) headers.set("Authorization", `Bearer ${token}`);

  let requestBody: BodyInit | undefined = body;
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    requestBody = JSON.stringify(json);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: requestBody,
    });
  } catch {
    throw new ApiError(
      0,
      "Sunucuya bağlanılamadı. Backend çalışıyor mu kontrol edin.",
    );
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res));
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
