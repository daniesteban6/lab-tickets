// Generador de carga minimo: N compras con C en paralelo.
// Uso: node scripts/carga.js [N=40] [C=10] [URL=http://localhost:3000]
//
// Reporta latencia p50 / p95 / max y cuantas compras fallaron.
// Con eso se compara, con numeros, el modo sync contra el async.

const N = Number(process.argv[2] ?? 40);
const C = Number(process.argv[3] ?? 10);
const URL = process.argv[4] ?? process.env.URL ?? 'http://localhost:3000';

const latencias = [];
let ok = 0;
let fallos = 0;
const errores = {};

async function unaCompra(i) {
  const t0 = performance.now();
  try {
    const r = await fetch(`${URL}/compras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ eventoId: i % 5 === 0 ? 'teatro' : 'concierto', cantidad: 1 }),
      signal: AbortSignal.timeout(30_000),
    });
    const cuerpo = await r.json();
    if (r.ok) ok++;
    else {
      fallos++;
      errores[cuerpo.error] = (errores[cuerpo.error] ?? 0) + 1;
    }
  } catch (err) {
    fallos++;
    errores[err.message] = (errores[err.message] ?? 0) + 1;
  } finally {
    latencias.push(performance.now() - t0);
  }
}

const inicio = performance.now();
let siguiente = 0;
async function trabajador() {
  while (siguiente < N) {
    const i = siguiente++;
    await unaCompra(i);
  }
}
await Promise.all(Array.from({ length: C }, trabajador));
const total = (performance.now() - inicio) / 1000;

latencias.sort((a, b) => a - b);
const p = (q) => Math.round(latencias[Math.min(latencias.length - 1, Math.floor(q * latencias.length))]);

console.log(`\n${N} compras, ${C} en paralelo, contra ${URL}`);
console.log(`  exitosas: ${ok}   fallidas: ${fallos}   duracion total: ${total.toFixed(1)} s`);
console.log(`  latencia  p50: ${p(0.5)} ms   p95: ${p(0.95)} ms   max: ${p(1)} ms`);
if (fallos) console.log('  errores:', errores);

const estado = await fetch(`${URL}/admin/estado`).then((r) => r.json()).catch(() => null);
if (estado?.colas) console.log('  colas:', JSON.stringify(estado.colas));
if (estado?.notificador) console.log('  notificador:', JSON.stringify(estado.notificador));
console.log('');
