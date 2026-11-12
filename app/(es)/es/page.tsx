import type { Metadata } from "next";
import Link from "next/link";
import ToolIcon from "@/components/ToolIcon";
import { registry } from "@/lib/registry";

export const metadata: Metadata = {
  title: { absolute: "Herramientas PDF gratis — Comprimir, unir y dividir sin subir archivos" },
  description:
    "Comprime, une, divide y convierte PDF a Excel gratis en tu navegador. Sin subir archivos, sin registro y sin marca de agua.",
  alternates: { canonical: "/es", languages: { en: "/", es: "/es", "x-default": "/" } },
};

const blurbs: Record<string, string> = {
  "compress-pdf": "Reduce el tamaño de un PDF con 3 niveles y mira el nuevo tamaño antes de descargarlo.",
  "merge-pdf": "Junta varios PDF en un solo archivo, en el orden que elijas, sin perder calidad.",
  "split-pdf": "Separa un PDF por rangos de páginas o cada N páginas y descárgalo en un ZIP.",
  "pdf-to-excel": "Pasa las tablas de un PDF a una hoja de cálculo .xlsx que puedes editar.",
};

export default function SpanishHome() {
  const tools = registry.filter((t) => t.es);
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 sm:py-16 w-full">
      <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-balance text-center">
        Herramientas PDF gratis que funcionan en tu navegador
      </h1>
      <p className="mt-4 text-center text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
        Tus archivos no se suben a ningún servidor: todo se procesa en tu propio dispositivo. Sin registro y sin marca de agua.
      </p>
      <ul className="mt-10 grid gap-3 sm:grid-cols-2">
        {tools.map((t) => (
          <li key={t.slug}>
            <Link
              href={`/es/${t.es!.slug}`}
              className="group flex gap-3 h-full rounded-xl border border-black/10 dark:border-white/10 p-5 hover:border-red-400 hover:shadow-md transition-all bg-white dark:bg-zinc-900"
            >
              <ToolIcon name={t.icon} className="h-6 w-6 shrink-0 text-red-600 mt-0.5" />
              <span>
                <span className="block font-semibold text-lg group-hover:text-red-600">{t.es!.name}</span>
                <span className="block text-sm text-zinc-600 dark:text-zinc-400 mt-1">{blurbs[t.slug]}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="article mt-12">
        <h2>¿Por qué no se sube nada?</h2>
        <p>
          La mayoría de los sitios de PDF envían tu archivo a su servidor, lo procesan allí y te lo devuelven.
          PDFCompact no. Al abrir una herramienta, tu navegador descarga el programa y lo ejecuta en tu
          dispositivo. Tu PDF se lee desde tu disco, se modifica en la memoria de la página y se guarda
          directamente en tus descargas. Puedes comprobarlo: carga una herramienta, desconecta el Wi‑Fi y
          seguirá funcionando.
        </p>
        <p>
          Eso importa cuando el archivo es un currículum, un pasaporte escaneado, una nómina o un contrato:
          no queda ninguna copia en un servidor ajeno.
        </p>
      </div>
    </div>
  );
}
