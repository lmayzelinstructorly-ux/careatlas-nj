// Loaded only by the isolated collector test. No requests leave this process.
globalThis.fetch = async (input) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === "clinic.example.invalid") {
    const body = url.pathname === "/locations/newark"
      ? "<title>Fixture Health Center</title><h1>Fixture Health Center</h1><p>100 Main Street, Newark NJ 07102. Phone 973-555-0100.</p>"
      : "<title>Organization</title><p>General organization information.</p>";
    return new Response(body, { headers: { "content-type": "text/html" } });
  }
  return new Response("Source unavailable in this test fixture.", { status: 503 });
};
