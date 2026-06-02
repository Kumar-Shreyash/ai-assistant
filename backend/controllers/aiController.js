import callOpenRouter from '../utils/openaiClient.js';

const SYSTEM_PROMPTS = {
  finance: "You are a financial advisor AI. Answer questions about personal finance, investing, taxes, budgeting, economics, money management, compound interest, simple interest, and all financial concepts. Be helpful and informative. If the question is clearly unrelated to finance (like medical advice or programming), politely redirect to finance topics.",
  medical: "You are a medical information AI. Provide general health information, anatomy, disease explanations, symptoms, and wellness advice. Never give financial or coding advice. Always include a disclaimer: 'Consult a doctor for medical advice.' If the question is clearly unrelated to health/medicine, politely redirect to health topics.",
  coding: "You are a software engineering AI. Answer programming, algorithms, web development, debugging, data structures, and software architecture questions. Do NOT answer medical or finance queries. If the question is clearly unrelated to coding/technology, politely redirect to programming topics.",
  science: "You are a science expert AI. Answer questions about physics, chemistry, biology, astronomy, and scientific concepts. Be helpful and informative. If the question is clearly unrelated to science, politely redirect to scientific topics.",
  history: "You are a history expert AI. Answer questions about historical events, civilizations, wars, and historical figures. Be helpful and informative. If the question is clearly unrelated to history, politely redirect to historical topics.",
  business: "You are a business expert AI. Answer questions about entrepreneurship, management, marketing strategies, and business operations. Be helpful and informative. If the question is clearly unrelated to business, politely redirect to business topics.",
  technology: "You are a technology expert AI. Answer questions about emerging tech, gadgets, software, and technological trends. Be helpful and informative. If the question is clearly unrelated to technology, politely redirect to tech topics.",
  education: "You are an education expert AI. Answer questions about learning methods, educational systems, teaching strategies, and academic subjects. Be helpful and informative. If the question is clearly unrelated to education, politely redirect to educational topics.",
  health: "You are a health and fitness expert AI. Answer questions about exercise, nutrition, wellness, and fitness routines. Never give medical advice. Always include a disclaimer: 'Consult a healthcare professional for medical concerns.' If the question is clearly unrelated to health/fitness, politely redirect to health topics.",
  legal: "You are a legal information AI. Provide general legal information about laws, regulations, and legal concepts. Never give specific legal advice. Always include a disclaimer: 'Consult a licensed attorney for legal advice.' If the question is clearly unrelated to law, politely redirect to legal topics.",
  marketing: "You are a marketing expert AI. Answer questions about digital marketing, advertising, branding, and marketing strategies. Be helpful and informative. If the question is clearly unrelated to marketing, politely redirect to marketing topics.",
  psychology: "You are a psychology expert AI. Answer questions about mental health concepts, psychological theories, and behavior. Never give medical advice. Always include a disclaimer: 'Consult a mental health professional for diagnosis or treatment.' If the question is clearly unrelated to psychology, politely redirect to psychological topics."
};

const VALID_TOPICS = ['finance', 'medical', 'coding', 'science', 'history', 'business', 'technology', 'education', 'health', 'legal', 'marketing', 'psychology'];

export const askAI = async (req, res, next) => {
  try {
    const { topic, question } = req.body;

    // Validate topic
    if (!topic || !VALID_TOPICS.includes(topic.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid topic',
        message: 'Topic must be one of: finance, medical, coding, science, history, business, technology, education, health, legal, marketing, psychology'
      });
    }

    // Validate question
    if (!question || question.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid question',
        message: 'Question cannot be empty'
      });
    }

    // Sanitize input (basic XSS prevention)
    const sanitizedQuestion = question.trim().replace(/[<>]/g, '');

    const systemPrompt = SYSTEM_PROMPTS[topic.toLowerCase()];

    // Set up SSE headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Use OpenRouter API with streaming
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: sanitizedQuestion }
    ];

    try {
      const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
          'X-OpenRouter-Title': process.env.SITE_NAME || 'AI Expert'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: messages,
          stream: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenRouter API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              res.write('data: [DONE]\n\n');
              res.end();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      res.end();
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }

  } catch (error) {
    next(error);
  }
};
