import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("src/i18n/locale.ts", "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const loadedModule = { exports: {} };

Function("exports", "module", code)(loadedModule.exports, loadedModule);

const { getBrowserLocale, isAppLocale } = loadedModule.exports;

assert.equal(getBrowserLocale(["pt-BR", "en-US"]), "pt-BR");
assert.equal(getBrowserLocale(["pt-PT"]), "pt-BR");
assert.equal(getBrowserLocale(["en-US", "pt-BR"]), "en");
assert.equal(getBrowserLocale(["es-419", "pt-BR"]), "pt-BR");
assert.equal(getBrowserLocale(["en-US", "es-419"]), "en");
assert.equal(getBrowserLocale([]), "en");
assert.equal(isAppLocale("en"), true);
assert.equal(isAppLocale("pt-BR"), true);
assert.equal(isAppLocale("pt"), false);

console.log("Validated browser locale resolution for English and Brazilian Portuguese.");
