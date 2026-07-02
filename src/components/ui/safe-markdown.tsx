import { Fragment } from "react";

/**
 * Renderiza markdown básico de forma SEGURA: parágrafos (linha em branco),
 * quebras de linha e **negrito**. O texto é escapado pelo React por construção
 * (nunca usamos `dangerouslySetInnerHTML`), então não há risco de injeção de HTML.
 * Suficiente para descrições de evento; markdown rico exigiria um sanitizador.
 */
export function SafeMarkdown({ text, className }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return null;
  return (
    <div className={className}>
      {paragraphs.map((para, pi) => (
        <p key={pi} className={pi > 0 ? "mt-3" : undefined}>
          {para.split("\n").map((line, li) => (
            <Fragment key={li}>
              {li > 0 && <br />}
              {renderInline(line)}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}

/** Aplica **negrito** dividindo em segmentos; cada segmento vira nó React. */
function renderInline(line: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((seg, i) => {
    const bold = /^\*\*([^*]+)\*\*$/.exec(seg);
    if (bold) return <strong key={i}>{bold[1]}</strong>;
    return <Fragment key={i}>{seg}</Fragment>;
  });
}
