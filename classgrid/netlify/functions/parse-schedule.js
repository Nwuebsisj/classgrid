// Netlify function: POST { image: base64, mediaType: 'image/jpeg' }
// Returns: { entries: [ { subject, section, room, type, day, start, end } ] }
//
// Requires env var ANTHROPIC_API_KEY set in Netlify site settings.

const SYSTEM_PROMPT = `You read Philippine college registration forms / certificates of registration (COR) and extract each class's weekly meeting sessions as structured JSON.

Key parsing rule: the Day and Time columns often hold two values separated by "/", e.g. Day "Thu/Fri" and Time "08:00 PM-09:00 PM/08:00 PM-09:00 PM". This means the FIRST day pairs with the FIRST time range, and the SECOND day pairs with the SECOND time range. If a row has only one day and one time, it's a single session. If Day and Time both repeat the same value twice (e.g. "Sat/Sat"), still emit two separate sessions since they may be lecture vs lab.

For each row in the schedule table, emit one JSON object per session (so a "Thu/Fri" row produces 2 objects, one for Thu and one for Fri):
{
  "subject": "<subject code>",
  "section": "<section code, if present>",
  "room": "<room for that specific session>",
  "type": "lec" or "lab" (guess "lab" only if the row's Lab hour column is non-zero and this session corresponds to the lab hours, otherwise "lec"),
  "day": one of "Mon","Tue","Wed","Thu","Fri","Sat","Sun",
  "start": "HH:MM" in 24-hour time,
  "end": "HH:MM" in 24-hour time
}

Convert all times to 24-hour "HH:MM" (e.g. "08:00 PM" -> "20:00", "07:30 AM" -> "07:30").
If a row lists two rooms separated by "/", pair them the same way as day/time (first room with first day/time, second room with second).
If a row has one room but two sessions, reuse that room for both.

Respond ONLY with a JSON object of the shape { "entries": [ ... ] } and nothing else — no markdown fences, no commentary.`;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { image, mediaType } = payload;
  if (!image) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing image' }) };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } },
              { type: 'text', text: 'Extract every class session from this registration form as instructed.' }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'Anthropic API error', detail: errText }) };
    }

    const data = await response.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock) {
      return { statusCode: 502, body: JSON.stringify({ error: 'No text response from model' }) };
    }

    let cleaned = textBlock.text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Could not parse model output', raw: cleaned }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
