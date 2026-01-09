export interface AIServiceSettings {
    openaiApiKey: string;
    model: string;
    useAI: boolean;
}

export class AIService {
    private settings: AIServiceSettings;

    constructor(settings: AIServiceSettings) {
        this.settings = settings;
    }

    updateSettings(settings: AIServiceSettings) {
        this.settings = settings;
    }

    async refineTags(tags: string[], noteContent: string): Promise<string[]> {
        if (!this.settings.useAI || !this.settings.openaiApiKey) {
            return tags;
        }

        try {
            const prompt = `다음은 문서에서 자동으로 추출된 태그 후보들입니다. 이 중에서 의미 있는 태그만 선별하고 정제해주세요.

태그 후보: ${tags.join(', ')}

문서 내용의 일부:
${noteContent.substring(0, 500)}

다음 기준으로 태그를 정제해주세요:
1. "있었다", "이렇게", "거다", "했다" 같은 동사나 조사는 제거
2. 실제 의미 있는 명사, 고유명사, 개념어만 남기기
3. 중복되거나 유사한 의미의 태그는 대표적인 것 하나로 통합
4. 최대 10개의 가장 중요한 태그만 선택
5. 태그는 원형으로 정리 (예: "차들" -> "자동차", "했다" 제거)

JSON 배열 형식으로만 응답하세요. 예: ["태그1", "태그2", "태그3"]`;

            // o1 models don't support system messages or temperature
            const isO1Model = this.settings.model.startsWith('o1');

            const messages = isO1Model ? [
                {
                    role: 'user',
                    content: `You are a helpful assistant that refines and improves tags for documents. Always respond with a JSON array of refined tags.\n\n${prompt}`
                }
            ] : [
                {
                    role: 'system',
                    content: 'You are a helpful assistant that refines and improves tags for documents. Always respond with a JSON array of refined tags.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ];

            const requestBody: any = {
                model: this.settings.model,
                messages: messages,
                max_tokens: 200
            };

            // Only add temperature for non-o1 models
            if (!isO1Model) {
                requestBody.temperature = 0.3;
            }

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.settings.openaiApiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.statusText}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;

            // Parse JSON response
            try {
                const refinedTags = JSON.parse(content);
                if (Array.isArray(refinedTags)) {
                    return refinedTags.filter(tag => typeof tag === 'string' && tag.length > 0);
                }
            } catch (parseError) {
                console.error('Failed to parse AI response:', parseError);
                // Try to extract tags from the response even if it's not valid JSON
                const matches = content.match(/"([^"]+)"/g);
                if (matches) {
                    return matches.map(m => m.replace(/"/g, '')).filter(tag => tag.length > 0);
                }
            }

            return tags; // Return original tags if parsing fails
        } catch (error) {
            console.error('AI refinement error:', error);
            return tags; // Return original tags on error
        }
    }
}