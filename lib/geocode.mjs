export async function geocodeMadridAddress(address) {
  const apiKey = process.env.GEOAPIFY_API_KEY;

  if (!apiKey) {
    throw new Error('GEOAPIFY_API_KEY no configurada');
  }

  const cleanAddress = String(address || '').trim();

  if (cleanAddress.length < 5) {
    throw new Error('Dirección no válida');
  }

  const params = new URLSearchParams({
    text: cleanAddress,
    format: 'json',
    filter: 'countrycode:es',
    bias: 'proximity:-3.7038,40.4168',
    lang: 'es',
    limit: '1',
    apiKey
  });

  const response = await fetch(
    `https://api.geoapify.com/v1/geocode/search?${params.toString()}`,
    {
      headers: {
        Accept: 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Geoapify respondió ${response.status}`);
  }

  const payload = await response.json();
  const result = payload.results?.[0];

  if (!result) {
    return null;
  }

  const latitude = Number(result.lat);
  const longitude = Number(result.lon);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
    formattedAddress:
      result.formatted ||
      cleanAddress,
    city:
      result.city ||
      result.county ||
      null,
    district:
      result.district ||
      result.suburb ||
      null,
    postcode:
      result.postcode ||
      null,
    confidence:
      Number(
        result.rank?.confidence ??
        0
      )
  };
}
