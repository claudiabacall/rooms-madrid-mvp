import { geocodeMadridAddress } from '../lib/geocode.mjs';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response
      .status(405)
      .setHeader('Allow', 'POST')
      .json({
        error: 'Method not allowed'
      });
    return;
  }

  try {
    const maxBytes = 4096;
    const contentLength = Number(request.headers?.['content-length']);

    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      response.status(413).json({
        error: 'Petición demasiado grande'
      });
      return;
    }

    const rawBody = typeof request.body === 'string'
      ? request.body
      : JSON.stringify(request.body || {});

    if (Buffer.byteLength(rawBody, 'utf8') > maxBytes) {
      response.status(413).json({
        error: 'Petición demasiado grande'
      });
      return;
    }

    const body = typeof request.body === 'string'
      ? JSON.parse(request.body || '{}')
      : request.body || {};

    const address =
      String(body.address || '').trim();

    if (address.length < 5 || address.length > 200) {
      response.status(400).json({
        error: 'Introduce una dirección válida'
      });
      return;
    }

    const result =
      await geocodeMadridAddress(address);

    if (!result) {
      response.status(404).json({
        error:
          'No hemos podido localizar esa dirección'
      });
      return;
    }

    response.status(200).json(result);
  } catch (error) {
    console.error(
      'Rooms geocode error:',
      error
    );

    response.status(500).json({
      error:
        'No hemos podido comprobar la dirección'
    });
  }
}
