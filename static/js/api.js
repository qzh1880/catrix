window.CATRIX_API = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? "http://127.0.0.1:8787"
  : "https://api.catrix.net";