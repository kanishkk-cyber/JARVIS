// netlify/functions/tts.js
// ElevenLabs TTS proxy — keeps your API key server-side and safe
// Deploy on Netlify. Set ELEVENLABS_API_KEY in Netlify → Site Settings → Environment Variables.

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'ELEVENLABS_API_KEY not configured in environment variables' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { text, voiceId = '21m00Tcm4TlvDq8ikWAM' } = body;

  if (!text || typeof text !== 'string' || text.length > 2000) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid text parameter' }) };
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: `ElevenLabs error: ${errText}` }),
      };
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'audio/mpeg',
      },
      body: base64Audio,
      isBase64Encoded: true,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
