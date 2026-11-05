import Link from "next/link";
import policies from "../../config/launch-policy-content.json";

export function ReleasePolicyPage({ id }: { id: string }) {
  const document = policies.documents.find((item) => item.id === id);
  if (!document) throw new Error("Unknown policy document");
  const version =
    "version" in document && typeof document.version === "string"
      ? document.version
      : policies.version;
  const date =
    "date" in document && typeof document.date === "string"
      ? document.date
      : policies.date;
  return (
    <article className="page narrow" aria-labelledby="policy-title">
      <p className="eyebrow">Docked policies</p>
      <h1 id="policy-title">{document.title}</h1>
      <p>{document.status}</p>
      <p>
        <small>
          Published {date} · Version {version}
        </small>
      </p>
      <nav aria-label="Policy documents">
        <ul>
          {policies.documents.map((item) => (
            <li key={item.id}>
              <Link
                href={`/${item.id}`}
                aria-current={item.id === id ? "page" : undefined}
              >
                {item.title}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/account-deletion">Delete your account</Link>
          </li>
        </ul>
      </nav>
      {document.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.text.split("\n\n").map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
      <p>{policies.operator}</p>
      <p>
        <a href="mailto:support@docked.com.au">support@docked.com.au</a>
      </p>
      <p>
        <Link href="/beta-policies">Previously accepted beta policies</Link>
      </p>
      {id === "privacy" && (
        <p>
          <a href="https://www.oaic.gov.au/privacy/privacy-complaints">
            OAIC privacy complaints
          </a>
        </p>
      )}
    </article>
  );
}
