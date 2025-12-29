import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Use POST" }),
        { status: 405 }
      );
    }

    const body = await req.json();
    const prompt = body?.prompt?.trim();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt vazio" }),
        { status: 400 }
      );
    }

    const apiKey = Deno.env.get("GROQ_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY não configurada" }),
        { status: 500 }
      );
    }

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [
            {
              role: "system",
              content:
                "Você é uma IA empática, acolhedora, escreve em português do Brasil e responde de forma curta e clara."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 300
        })
      }
    );

    const data = await groqResponse.json();

    console.log("Groq RAW:", JSON.stringify(data));

    let text = "Não consegui gerar uma resposta agora.";

    if (
      data?.choices &&
      Array.isArray(data.choices) &&
      data.choices[0]?.message?.content
    ) {
      text = data.choices[0].message.content.trim();
    }

    return new Response(
      JSON.stringify({ text }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Erro IA:", err);

    return new Response(
      JSON.stringify({ text: "Erro ao consultar a IA." }),
      { status: 500 }
    );
  }
});

