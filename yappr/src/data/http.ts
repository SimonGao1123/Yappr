/* Every fetch in the app used to call .json() without checking the status, so a
   500 with an error body was parsed and treated as success. Route all requests
   through here instead. */

export class HttpError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'HttpError';
    }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
        credentials: 'include',
        ...init,
    });

    let body: unknown = null;
    try {
        body = await response.json();
    } catch {
        // non-JSON body (proxy error page, empty 204); handled below
    }

    if (!response.ok) {
        const message =
            (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
                ? body.message
                : null) ?? `Request failed (${response.status})`;
        throw new HttpError(response.status, message);
    }

    return body as T;
}

export function postJson<T>(url: string, payload: unknown): Promise<T> {
    return fetchJson<T>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
}

export function errorMessage(err: unknown): string {
    if (err instanceof HttpError) return err.message;
    if (err instanceof Error) return err.message;
    return 'Something went wrong';
}
