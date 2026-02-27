import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Configuration ---
const GEMINI_KEYS = [
    process.env.GEMINI_ANALYSIS_KEY,
    process.env.GEMINI_LOOKUP_KEY
].filter(Boolean) as string[];

const BACKUP_API_KEY = process.env.BACKUP_AI_API_KEY || '';
const BACKUP_MODELS = (process.env.BACKUP_AI_MODELS || '').split(',').map(m => m.trim()).filter(m => m);

// SiliconFlow is very common for these models in VN. 
// Added some common variations/proxies because .top was not resolving.
const BACKUP_BASE_URLS = [
    'https://api.siliconflow.cn/v1',
    'https://api.openai.com/v1',
    'https://api.beeai.site/v1',
    'https://api.v-kb.com/v1',
];

// --- State ---
let currentModelIndex = 0;
let currentBaseUrlIndex = 0;

/**
 * Unified interface for AI content generation with rotation and backup support.
 */
export async function generateAIContent(prompt: string, options: {
    model?: string,
    providerPreference?: 'gemini' | 'backup'
} = {}): Promise<string> {
    const { providerPreference = 'gemini', model = 'gemini-2.0-flash' } = options;

    // Try preferred provider first
    if (providerPreference === 'gemini') {
        try {
            return await callGeminiWithRotation(prompt, model);
        } catch (error) {
            console.warn(`[AI Provider] All Gemini keys failed, falling back to backup.`, error);
            return await callBackupAIWithRotation(prompt);
        }
    } else {
        try {
            return await callBackupAIWithRotation(prompt);
        } catch (error) {
            console.warn('[AI Provider] All backup models failed, falling back to Gemini.', error);
            return await callGeminiWithRotation(prompt, model);
        }
    }
}

/**
 * Helper to call Gemini with key rotation on failure (especially for 429)
 */
async function callGeminiWithRotation(prompt: string, preferredModel: string): Promise<string> {
    if (GEMINI_KEYS.length === 0) throw new Error('No Gemini API keys configured');

    const modelsToTry = [preferredModel, 'gemini-2.0-flash', 'gemini-1.5-flash'];
    const uniqueModels = [...new Set(modelsToTry)];

    for (const key of GEMINI_KEYS) {
        for (const modelName of uniqueModels) {
            try {
                process.stdout.write(`[AI Provider] Trying Gemini with model ${modelName}...\n`);
                return await callGemini(prompt, modelName, key);
            } catch (error: any) {
                const isRateLimit = error.message?.includes('429') || error.message?.includes('Too Many Requests');
                console.warn(`[AI Provider] Gemini (${modelName}) failed with key ending in ...${key.slice(-4)}. Error: ${error.message}`);

                if (isRateLimit) {
                    // Try next key immediately
                    break;
                }
                // If it's a 404 or other error, try next model with same key
                continue;
            }
        }
    }
    throw new Error('All Gemini keys and models failed');
}

/**
 * Helper to call Gemini
 */
async function callGemini(prompt: string, modelName: string, apiKey: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
}

/**
 * Helper to call Backup AI with model rotation on failure
 */
async function callBackupAIWithRotation(prompt: string): Promise<string> {
    if (!BACKUP_API_KEY || BACKUP_MODELS.length === 0) {
        throw new Error('Backup AI is not configured');
    }

    // Try each model starting from the current one
    const startIndex = currentModelIndex;

    for (let i = 0; i < BACKUP_MODELS.length; i++) {
        const activeIndex = (startIndex + i) % BACKUP_MODELS.length;
        const model = BACKUP_MODELS[activeIndex];

        // Also try multiple base URLs if one fails
        for (let j = 0; j < BACKUP_BASE_URLS.length; j++) {
            const baseUrlActiveIndex = (currentBaseUrlIndex + j) % BACKUP_BASE_URLS.length;
            const baseUrl = BACKUP_BASE_URLS[baseUrlActiveIndex];

            try {
                console.log(`[AI Provider] Trying backup model: ${model} at ${baseUrl}`);
                const result = await callOpenAICompatible(prompt, model, baseUrl);

                // Success! Save these for next time to be efficient
                currentModelIndex = activeIndex;
                currentBaseUrlIndex = baseUrlActiveIndex;
                return result;
            } catch (error: any) {
                console.error(`[AI Provider] Model ${model} at ${baseUrl} failed:`, error.message);
                // Continue to next URL or next model
                continue;
            }
        }
    }

    throw new Error('All backup AI models and base URLs failed');
}

/**
 * Perform an OpenAI-compatible API call using fetch
 */
async function callOpenAICompatible(prompt: string, model: string, baseUrl: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${BACKUP_API_KEY}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error (${response.status}): ${errorText.slice(0, 100)}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    } catch (err) {
        clearTimeout(timeoutId);
        throw err;
    }
}
