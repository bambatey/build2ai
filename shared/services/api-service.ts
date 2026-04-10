import type { ApiNamespace } from './api-namespaces';
import type { BusinessLogicDto } from './business-logic-dto';
import type { ApiStreamingResponse } from './llm-proxy';

const baseUrl = "https://structapp.xyz/api";

// ---! Timeout configuration for long-running requests (5 minutes)
const DEFAULT_TIMEOUT = 300000; // 5 minutes in milliseconds

class ApiHandler {

    private _token: string | null = null

    // ---! Token'ı dışarıdan set et (useAuth composable tarafından çağrılır)
    public setToken(token: string | null) {
        this._token = token
    }

    // ---! Auth header'ları dahil tüm header'ları oluştur
    private getAuthHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'accept': 'application/json',
            'Content-Type': 'application/json',
        }
        if (this._token) {
            headers['Authorization'] = `Bearer ${this._token}`
        }
        return headers
    }

    // ---! Helper method to create fetch with timeout
    private async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = DEFAULT_TIMEOUT): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeoutMs}ms`);
            }
            throw error;
        }
    }

    public async get<T>(namespace: ApiNamespace, endPoint?: string, queryParams: string = ''): Promise<BusinessLogicDto<T>> {
        let url = `${baseUrl}/${namespace}`;
        if (endPoint) {
            url += `/${endPoint}`;
        }
        if (queryParams) {
            url += `?${queryParams}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: this.getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch data from ${url}`);
        }

        return response.json() as Promise<BusinessLogicDto<T>>;
    }

    public async getRaw<T extends object>(namespace: ApiNamespace, endPoint: string, queryParams: string = ''): Promise<T> {
        let url = `${baseUrl}/${namespace}/${endPoint}`;
        if (queryParams) {
            url += `?${queryParams}`;
        }
        const response = await this.fetchWithTimeout(url, {
            method: 'GET',
            headers: this.getAuthHeaders(),
        });
        return response.json() as Promise<T>;
    }

    public async post<T>(namespace: ApiNamespace, endPoint?: string, data?: any): Promise<BusinessLogicDto<T>> {
        let url = `${baseUrl}/${namespace}`;
        if (endPoint) {
            url += `/${endPoint}`;
        }
        const response = await this.fetchWithTimeout(url, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(data)
        });

        if (response.status === 302 || response.type === 'opaqueredirect') {
            window.location.href = '/oauth2/start?rd=' + encodeURIComponent(window.location.pathname);
            return new Promise(() => { });
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch data from ${url}`);
        }

        return response.json() as Promise<BusinessLogicDto<T>>;
    }

    public async postFormData<T>(namespace: ApiNamespace, endPoint?: string, formData?: FormData): Promise<BusinessLogicDto<T>> {
        let url = `${baseUrl}/${namespace}`;
        if (endPoint) {
            url += `/${endPoint}`;
        }
        const authHeaders = this.getAuthHeaders()
        delete authHeaders['Content-Type'] // Browser will set it with boundary
        const response = await fetch(url, {
            method: 'POST',
            headers: authHeaders,
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch data from ${url}`);
        }

        return response.json() as Promise<BusinessLogicDto<T>>;
    }

    public async postStream<T extends object>(baseUrl: string, namespace: ApiNamespace, endPoint: string, body: any) {

        try {
            const response = await fetch(`${baseUrl}/${namespace}/${endPoint}`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            if (!response.body) {
                throw new Error('No response body received');
            }

            // ---! Create a readable stream that transforms the API response
            return new ReadableStream({
                async start(controller) {
                    const reader = response.body!.getReader();
                    const decoder = new TextDecoder();
                    let streamClosed = false;

                    try {
                        while (true) {
                            const { done, value } = await reader.read();

                            if (done) {
                                // ---! Send final complete message
                                if (!streamClosed) {
                                    controller.enqueue({
                                        content: '',
                                        reasoning: '',
                                        isComplete: true
                                    });
                                    controller.close();
                                    streamClosed = true;
                                }
                                break;
                            }
                            // ---! Decode the chunk and parse JSON
                            const chunk = decoder.decode(value, { stream: true });
                            const lines = chunk.split('\n').filter(line => line.trim());

                            for (const line of lines) {
                                // ---! Handle Server-Sent Events format (data: prefix)
                                if (line.startsWith('data: ')) {
                                    const jsonData = line.slice(6); // ---! Remove 'data: ' prefix

                                    // ---! Skip empty data lines
                                    if (jsonData.trim() === '') {
                                        continue;
                                    }

                                    try {
                                        const apiResponse: ApiStreamingResponse<T> = JSON.parse(jsonData);

                                        // ---! Only process delta messages (actual content updates)
                                        if (apiResponse.type === 'delta') {
                                            // ---! Transform API response to our format
                                            // ---! Note: content is in reasoning field, content field is empty
                                            apiResponse.isComplete = false;
                                            controller.enqueue(apiResponse);
                                        }

                                        // ---! Close stream on finish or done messages (only once)
                                        if ((apiResponse.type === 'finish' || apiResponse.type === 'done') && !streamClosed) {
                                            controller.close();
                                            streamClosed = true;
                                            break;
                                        }
                                    } catch (parseError) {
                                        console.warn('Failed to parse JSON data:', jsonData, parseError);
                                    }
                                } else {
                                    // ---! Handle non-SSE lines (fallback for pure JSON)
                                    try {
                                        const apiResponse: ApiStreamingResponse<T> = JSON.parse(line);

                                        // ---! Only process delta messages (actual content updates)
                                        if (apiResponse.type === 'delta') {
                                            // ---! Transform API response to our format
                                            // ---! Note: content is in reasoning field, content field is empty
                                            apiResponse.isComplete = false;
                                            controller.enqueue(apiResponse);
                                        }

                                        // ---! Close stream on finish or done messages (only once)
                                        if ((apiResponse.type === 'finish' || apiResponse.type === 'done') && !streamClosed) {
                                            controller.close();
                                            streamClosed = true;
                                            break;
                                        }
                                    } catch (parseError) {
                                        console.warn('Failed to parse JSON line:', line, parseError);
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        controller.error(error);
                    } finally {
                        reader.releaseLock();
                    }
                }
            });

        } catch (error) {
            // ---! Return a stream with error
            return new ReadableStream({
                start(controller) {
                    controller.enqueue({
                        isComplete: true,
                        error: error instanceof Error ? error.message : 'Unknown error occurred'
                    });
                    controller.close();
                }
            });
        }
    }

}

export const apiHandler = new ApiHandler();