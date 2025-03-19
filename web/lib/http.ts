export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3333";
let authToken: string | null = null;

const http = {
  setAuthToken(token: string) {
    authToken = token;
  },

  async request<T>(
    endpoint: string,
    method: string = "GET",
    body?: any,
  ): Promise<T> {
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("HTTP Request Failed:", error);
      throw error;
    }
  },

  async get<T>(endpoint: string): Promise<T> {
    return await http.request<T>(endpoint, "GET");
  },

  async post<T>(endpoint: string, body: any): Promise<T> {
    return await http.request<T>(endpoint, "POST", body);
  },

  async put<T>(endpoint: string, body: any): Promise<T> {
    return await http.request<T>(endpoint, "PUT", body);
  },

  async delete<T>(endpoint: string): Promise<T> {
    return await http.request<T>(endpoint, "DELETE");
  },
};

export default http;
