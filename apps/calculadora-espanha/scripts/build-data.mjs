// Converte a planilha-mestre (data/*.csv, separador ";" e decimal ",", padrão Excel pt-BR)
// em data.js, carregado pela página. Uso: node scripts/build-data.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ABAS = ["fontes", "parametros", "cidades", "tipologias", "perfis", "itens", "cambio"];

function valor(s) {
  s = s.trim();
  if (s === "") return null;
  if (/^-?\d+(,\d+)?$/.test(s)) return Number(s.replace(",", "."));
  return s;
}

function lerCsv(nome) {
  const linhas = readFileSync(join(raiz, "data", nome + ".csv"), "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(l => l.trim());
  const cab = linhas[0].split(";").map(c => c.trim());
  return linhas.slice(1).map((l, i) => {
    const cel = l.split(";");
    if (cel.length !== cab.length) throw new Error(`${nome}.csv linha ${i + 2}: ${cel.length} colunas, esperado ${cab.length}`);
    return Object.fromEntries(cab.map((c, j) => [c, valor(cel[j])]));
  });
}

const d = Object.fromEntries(ABAS.map(a => [a, lerCsv(a)]));
// parâmetros e fontes viram dicionários
d.parametros = Object.fromEntries(d.parametros.map(p => [p.chave, p.valor]));
d.fontes = Object.fromEntries(d.fontes.map(f => [f.id, f]));

// Validação: toda fonte citada precisa existir em fontes.csv
const citadas = [];
for (const aba of ["cidades", "tipologias", "itens", "cambio"])
  for (const r of d[aba]) for (const [k, v] of Object.entries(r))
    if ((k === "fonte" || k.startsWith("fonte_")) && v && !String(v).startsWith("@")) citadas.push([aba, v]);
const faltando = citadas.filter(([, f]) => !d.fontes[f]);
if (faltando.length) throw new Error("Fontes inexistentes: " + JSON.stringify(faltando));

writeFileSync(join(raiz, "data.js"),
  "// GERADO por scripts/build-data.mjs a partir de data/*.csv. Não edite à mão.\n" +
  "window.CALC_DATA = " + JSON.stringify(d, null, 1) + ";\n");
console.log("data.js gerado:", ABAS.map(a => `${a}=${Array.isArray(d[a]) ? d[a].length : Object.keys(d[a]).length}`).join(" "));
