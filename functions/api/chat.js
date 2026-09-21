export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();
        const { modelId, contents, maxOutputTokens, temperature, topK, topP } = body;

        const keysRaw = env.api_keys || '';
        const keys = keysRaw.split(',').map(k => k.trim()).filter(Boolean);

        if (keys.length === 0) {
            return new Response(
                JSON.stringify({ error: 'Nenhuma chave configurada no servidor' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        let lastStatus = 500;

        for (let i = 0; i < keys.length; i++) {
            const apiKey = keys[i];
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?key=${apiKey}&alt=sse`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        maxOutputTokens: maxOutputTokens || 8000,
                        temperature: temperature ?? 0.7,
                        topK: topK ?? 40,
                        topP: topP ?? 0.95
                    }
                })
            });

            if (response.ok) {
                return new Response(response.body, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive'
                    }
                });
            }

            lastStatus = response.status;

            if (response.status === 429 || response.status === 403 || response.status === 400) {
                continue;
            }

            const errText = await response.text();
            return new Response(
                JSON.stringify({ error: 'Erro da API do Google', status: response.status, detail: errText }),
                { status: response.status, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ error: 'Todas as chaves falharam', status: lastStatus }),
            { status: lastStatus, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (err) {
        return new Response(
            JSON.stringify({ error: 'Erro interno', detail: String(err) }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
