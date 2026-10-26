import { templates, type Project } from "../models/project";

export function Cover({
  onChoose,
}: {
  onChoose: (id: Project["template"]) => void;
  onResume: () => void;
  onOpen: () => void;
  message: string;
}) {
  return (
    <main className="simple-cover">
      <header>
        <h1>Ceteris</h1>
      </header>
      <nav className="diagram-choices" aria-label="Choose a diagram">
        {templates.map((template) => (
          <button key={template.id} onClick={() => onChoose(template.id)}>
            {template.name}
          </button>
        ))}
      </nav>
    </main>
  );
}
