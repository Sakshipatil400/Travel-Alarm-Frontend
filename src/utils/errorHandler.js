/**
 * Centralized API error handling utility.
 *
 * Rules:
 * 1. HTTP 401: "Session expired. Please login again."
 * 2. HTTP 404: "Requested resource was not found."
 * 3. HTTP 409: Display the exact backend message when available (especially for destination deletion).
 * 4. HTTP 500 or other server errors: "Something went wrong. Please try again."
 * 5. Network/API unavailable: "Unable to connect to the server."
 */

/**
 * Extracts a human-readable message from backend response data if available.
 * Handles strings, standard objects ({ message }, { error }, { detail }, { title }),
 * and ASP.NET validation error maps.
 */
export function extractBackendMessage(data) {
    if (!data) return "";
    if (typeof data === "string" && data.trim()) {
        return data.trim();
    }
    if (typeof data === "object") {
        if (typeof data.message === "string" && data.message.trim()) {
            return data.message.trim();
        }
        if (typeof data.error === "string" && data.error.trim()) {
            return data.error.trim();
        }
        if (typeof data.detail === "string" && data.detail.trim()) {
            return data.detail.trim();
        }
        if (typeof data.title === "string" && data.title.trim()) {
            return data.title.trim();
        }
        if (data.errors && typeof data.errors === "object") {
            const keys = Object.keys(data.errors);
            if (keys.length > 0) {
                const firstVal = data.errors[keys[0]];
                if (Array.isArray(firstVal) && firstVal.length > 0 && typeof firstVal[0] === "string") {
                    return firstVal[0];
                }
                if (typeof firstVal === "string" && firstVal.trim()) {
                    return firstVal.trim();
                }
            }
        }
    }
    return "";
}

/**
 * Returns the standardized error message matching the application rules.
 *
 * @param {any} error - The caught Axios error
 * @param {string} [defaultFallback="Something went wrong. Please try again."]
 * @returns {string} User-facing error message
 */
export function getApiErrorMessage(error, defaultFallback = "Something went wrong. Please try again.") {
    if (!error) return defaultFallback;

    // Rule 5: Network / API unavailable (no HTTP response received)
    if (!error.response) {
        return "Unable to connect to the server.";
    }

    const { status, data } = error.response;

    // Rule 1: HTTP 401
    if (status === 401) {
        return "Session expired. Please login again.";
    }

    // Rule 2: HTTP 404
    if (status === 404) {
        return "Requested resource was not found.";
    }

    // Rule 3: HTTP 409 (Display the exact backend message when available)
    if (status === 409) {
        const backendMsg = extractBackendMessage(data);
        return backendMsg || defaultFallback;
    }

    // Rule 4: HTTP 500 or other server errors (>= 500)
    if (status >= 500) {
        return "Something went wrong. Please try again.";
    }

    // Other 4xx client errors (e.g., 400 Bad Request, 422 Unprocessable Entity)
    const clientBackendMsg = extractBackendMessage(data);
    if (clientBackendMsg) {
        return clientBackendMsg;
    }

    return defaultFallback;
}
