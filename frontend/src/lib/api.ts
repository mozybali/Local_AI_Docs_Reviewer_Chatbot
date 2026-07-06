// Backend API ile iletişim için basit yardımcı katman.
// Temel URL `.env.local` içindeki NEXT_PUBLIC_API_URL değerinden okunur.
// Varsayılan "/backend" göreli yoldur: istekler aynı origin'e gider ve
// next.config.js'teki rewrite kuralı onları FastAPI'ye iletir. Backend'e
// doğrudan bağlanmak için NEXT_PUBLIC_API_URL'e mutlak bir URL verin.

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "/backend";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Oturum süresi dolduğunda (kimlikli bir istek 401 dönerse) çağrılacak global
// kanca. `AuthContext` burayı `logout` ile doldurur; böylece token geçersizse
// kullanıcı otomatik olarak çıkış yaptırılıp giriş ekranına yönlendirilir.
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

/**
 * Bir hatadan kullanıcıya gösterilecek anlaşılır bir mesaj üretir.
 * - `ApiError` ise backend'in döndürdüğü (zaten Türkçe) mesajı kullanır.
 * - Aksi halde verilen `fallback` mesajına düşer.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  return fallback;
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
    // Kimlikli bir istek 401 dönerse token geçersiz/expired demektir:
    // oturumu kapat (handler ProtectedRoute üzerinden login'e yönlendirir).
    if (res.status === 401 && token) {
      unauthorizedHandler?.();
    }
    throw new ApiError(res.status, await parseError(res));
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
