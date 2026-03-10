const https = require("https");

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const geocodeLocation = ({ city, state }) => {
  if (!city || !state) {
    return Promise.resolve(null);
  }

  const country = process.env.DEFAULT_COUNTRY || "India";
  const query = `${city}, ${state}, ${country}`;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;

  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "LeniDeni/1.0 (marketplace geocoding)",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });

        res.on("end", () => {
          try {
            const results = JSON.parse(body);
            const top = Array.isArray(results) ? results[0] : null;
            const lat = toFiniteNumber(top?.lat);
            const lng = toFiniteNumber(top?.lon);
            if (lat === null || lng === null) {
              resolve(null);
              return;
            }
            resolve({ lat, lng });
          } catch (error) {
            resolve(null);
          }
        });
      },
    );

    req.setTimeout(4000, () => {
      req.destroy();
      resolve(null);
    });

    req.on("error", () => resolve(null));
  });
};

const resolveCoordinates = async ({ city, state, lat, lng, fallback }) => {
  const explicitLat = toFiniteNumber(lat);
  const explicitLng = toFiniteNumber(lng);

  if (explicitLat !== null && explicitLng !== null) {
    return [explicitLng, explicitLat];
  }

  const geocoded = await geocodeLocation({ city, state });
  if (geocoded) {
    return [geocoded.lng, geocoded.lat];
  }

  return fallback;
};

module.exports = { resolveCoordinates };
