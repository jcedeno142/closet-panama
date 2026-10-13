const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
function load(relativePath, requireModule) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function("require", "exports", javascript)(requireModule, exports);
  return exports;
}
const mode = load("lib/marketplace-mode.ts", require);

for (const directory of ["orders", "payments", "delivery"]) {
  for (const entry of fs.readdirSync(path.join(root, "app/api", directory))) {
    const routePath = `app/api/${directory}/${entry}/route.ts`;
    if (!fs.existsSync(path.join(root, routePath))) continue;
    test(`${routePath} rejects managed operations without touching accounts or money`, async () => {
      assert.equal(mode.managedPaymentsEnabled, false);
      const route = load(routePath, name => {
        if (name === "@/lib/marketplace-mode") return mode;
        if (name === "next/server") return { NextResponse: Response };
        if (name.startsWith("@/lib/supabase/")) return {
          createClient: () => { throw new Error("Unexpected authenticated database access"); },
          createAdminClient: () => { throw new Error("Unexpected privileged database access"); },
        };
        return require(name);
      });
      const response = await (route.POST || route.GET)(new Request("http://localhost/api", { method: route.POST ? "POST" : "GET" }));
      assert.equal(response.status, 409);
      assert.match((await response.json()).error, /directamente/);
    });
  }
}
