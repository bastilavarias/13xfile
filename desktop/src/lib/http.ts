require("dotenv").config();
export const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3333";
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

  get<T>(endpoint: string): Promise<T> {
    return http.request<T>(endpoint, "GET");
  },

  post<T>(endpoint: string, body: any): Promise<T> {
    return http.request<T>(endpoint, "POST", body);
  },

  put<T>(endpoint: string, body: any): Promise<T> {
    return http.request<T>(endpoint, "PUT", body);
  },

  delete<T>(endpoint: string): Promise<T> {
    return http.request<T>(endpoint, "DELETE");
  },
};

export default http;
