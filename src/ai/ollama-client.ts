import { requestUrl } from "obsidian";
import type { z } from "zod";
import type { Schema } from "@google/genai";
import type { LawNoteSettings } from "../types";
import type { LLMClient } from "./llm-provider";
import { OllamaEmbedder } from "./embedder";
import { parseAndValidate } from "./json-parse";

const DEFAULT_MODEL = "llama3.1";

/**
 * Fully-local generation via an Ollama server — no API key, no quota, offline,
 * on-device. Pairs with the local Ollama embedder so the whole plugin can run
 * without any cloud calls.
 *
 * Note: `requestUrl` buffers the whole response, so streaming is emitted as a
 * single final chunk rather than token-by-token.
 */
export class OllamaClient implements LLMClient {
    private baseUrl: string;
    private model: string;
    private temperature: number;
    private embedder: OllamaEmbedder;
    private totalTokensUsed = 0;

    constructor(settings: LawNoteSettings) {
        this.baseUrl = (settings.ollamaUrl || "http://localhost:11434").replace(/\/+$/, "");
        this.model = settings.ollamaModel || DEFAULT_MODEL;
        this.temperature = settings.temperature;
        this.embedder = new OllamaEmbedder(settings);
    }

    getTotalTokensUsed(): number {
        return this.totalTokensUsed;
    }

    embedTexts(texts: string[]): Promise<number[][]> {
        return this.embedder.embedTexts(texts);
    }

    abort(): void {
        // requestUrl has no abort handle; runs to completion.
    }

    generate(prompt: string): Promise<string> {
        return this.run(prompt, false);
    }

    async generateStructured<T>(
        prompt: string,
        schema: z.ZodSchema<T>,
        _responseSchema?: Schema
    ): Promise<T> {
        return parseAndValidate(await this.run(prompt, true), schema);
    }

    async generateStreaming(
        prompt: string,
        onChunk: (text: string, accumulated: string) => void,
        jsonMode = false,
        _responseSchema?: Schema
    ): Promise<string> {
        const text = await this.run(prompt, jsonMode);
        onChunk(text, text);
        return text;
    }

    async generateStructuredStreaming<T>(
        prompt: string,
        schema: z.ZodSchema<T>,
        onChunk: (text: string, accumulated: string) => void,
        responseSchema?: Schema
    ): Promise<T> {
        return parseAndValidate(await this.generateStreaming(prompt, onChunk, true, responseSchema), schema);
    }

    private async run(prompt: string, jsonMode: boolean): Promise<string> {
        const data = await this.post(prompt, jsonMode);
        this.totalTokensUsed += (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0);
        if (!data.response) throw new Error("Empty response from Ollama.");
        return data.response;
    }

    private async post(
        prompt: string,
        jsonMode: boolean
    ): Promise<{ response?: string; prompt_eval_count?: number; eval_count?: number }> {
        const body: Record<string, unknown> = {
            model: this.model,
            prompt,
            stream: false,
            options: { temperature: this.temperature },
        };
        if (jsonMode) body.format = "json";

        try {
            const res = await requestUrl({
                url: `${this.baseUrl}/api/generate`,
                method: "POST",
                contentType: "application/json",
                body: JSON.stringify(body),
            });
            return res.json as { response?: string; prompt_eval_count?: number; eval_count?: number };
        } catch (error) {
            const raw = error instanceof Error ? error.message : String(error);
            throw new Error(
                `Ollama generation failed at ${this.baseUrl} (model "${this.model}"). ` +
                    `Is Ollama running and the model pulled (\`ollama pull ${this.model}\`)? ` +
                    `For 403/CORS set OLLAMA_ORIGINS=* and restart Ollama. [${raw}]`
            );
        }
    }
}
