const ENDPOINT = `${import.meta.env.BASE_URL}api/lead.php`;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const UTM_STORE = "vls-utm";

function readUtm() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = {};
  UTM_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) fromUrl[key] = value;
  });
  try {
    if (Object.keys(fromUrl).length) {
      sessionStorage.setItem(UTM_STORE, JSON.stringify(fromUrl));
      return fromUrl;
    }
    return JSON.parse(sessionStorage.getItem(UTM_STORE) || "{}");
  } catch (error) {
    return fromUrl;
  }
}

const utm = readUtm();
const landingPage = window.location.href;

export async function sendLead(fields) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    keepalive: true,
    body: JSON.stringify({ ...fields, page: landingPage, referrer: document.referrer || "", utm }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`);
  return data;
}
