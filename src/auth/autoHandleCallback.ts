import api from "../lib/http";

export async function autoHandleCallback(setUser: (user: any) => void) {
  // Check fragment or query for id_token
  try {
    const hash = window.location.hash || window.location.search;
    let idToken = null;
    if (hash && (hash.includes("id_token=") || hash.includes("access_token="))) {
      const params = new URLSearchParams(hash.replace(/^#/, "").replace(/^\?/, ""));
      idToken = params.get("id_token");
      // cleanup URL
      window.history.replaceState({}, "", window.location.pathname);
    } else {
      idToken = localStorage.getItem("strun_id_token");
    }

    if (!idToken) return null;

    // store locally and verify with backend
    localStorage.setItem("strun_id_token", idToken);
    const resp = await fetch(`${import.meta.env.VITE_API_BASE || "http://localhost:4000/api"}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ id_token: idToken })
    });
    const json = await resp.json();
    if (json.ok && json.user) {
      localStorage.setItem("strun_user", JSON.stringify(json.user));
      setUser(json.user);
      return json.user;
    } else {
      // invalid => remove token
      localStorage.removeItem("strun_id_token");
      return null;
    }
  } catch (e) {
    console.error("autoHandleCallback error", e);
    return null;
  }
}