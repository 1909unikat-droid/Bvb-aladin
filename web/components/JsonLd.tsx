/**
 * Renders a <script type="application/ld+json"> tag server-side.
 * Accepts any JSON-LD object conforming to schema.org.
 */
export function JsonLd({ schema }: { schema: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
