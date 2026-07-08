// Netlify function: POST { image: base64, mediaType: 'image/jpeg' }
// Returns: { entries: [ { subject, section, desc, room, type, day, start, end } ] }
//
// Requires env var GEMINI_API_KEY set in Netlify site settings.
// Get a free key at https://aistudio.google.com/apikey

const SYSTEM_PROMPT = `You read Philippine college registration forms / certificates of registration (COR) and extract each class's weekly meeting sessions as structured JSON.

Key parsing rule: the Day and Time columns often hold two values separated by "/", e.g. Day "Thu/Fri" and Time "08:00 PM-09:00 PM/08:00 PM-09:00 PM". This means the FIRST day pairs with the FIRST time range, and the SECOND day pairs with the SECOND time range. If a row has only one day and one time, it's a single session. If Day and Time both repeat the same value twice (e.g. "Sat/Sat"), still emit two separate sessions since they may be lecture vs lab.

For each row in the schedule table, emit one JSON object per session (so a "Thu/Fri" row produces 2 objects, one for Thu and one for Fri):
{
  "subject": "<subject code, e.g. 'CRI 169'>",
  "section": "<section code, if present>",
  "desc": "<the class's full title/description text from the Description column, e.g. 'Fundamentals of Criminal Investigation and Intelligence'>",
  "room": "<room for that specific session>",
  "type": "lec" or "lab" (guess "lab" only if the row's Lab hour column is non-zero and this session corresponds to the lab hours, otherwise "lec"),
  "day": one of "Mon","Tue","Wed","Thu","Fri","Sat","Sun",
  "start": "HH:MM" in 24-hour time,
  "end": "HH:MM" in 24-hour time
}

Always populate "desc" from the Description column if the table has one — never leave it as an empty string when a description is visible in the image. Do not abbreviate or invent it; copy the description text as printed.

Convert all times to 24-hour "HH:MM" (e.g. "08:00 PM" -> "20:00", "07:30 AM" -> "07:30").
If a row lists two rooms separated by "/", pair them the same way as day/time (first room with first day/time, second room with second).
If a row has one room but two sessions, reuse that room for both.

Respond ONLY with a JSON object of the shape { "entries": [ ... ] } and nothing else — no markdown fences, no commentary.`;

const GEMINI_MODEL = 'gemini-2.5-flash';

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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: mediaType || 'image/jpeg', data: image } },
                { text: 'Extract every class session from this registration form as instructed. Make sure every entry includes its "desc" from the Description column.' }
              ]
            }
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                entries: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      subject: { type: 'STRING' },
                      section: { type: 'STRING' },
                      desc: { type: 'STRING' },
                      room: { type: 'STRING' },
                      type: { type: 'STRING', enum: ['lec', 'lab'] },
                      day: { type: 'STRING', enum: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
                      start: { type: 'STRING' },
                      end: { type: 'STRING' }
                    },
                    required: ['subject', 'day', 'start', 'end']
                  }
                }
              },
              required: ['entries']
            }
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'Gemini API error', detail: errText }) };
    }

    const data = await response.json();
    const textBlock = data?.candidates?.[0]?.content?.parts?.find(p => typeof p.text === 'string');
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
