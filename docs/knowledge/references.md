# External references

Links collected for this project. Converted from macOS `.webloc` bookmark files, which are opaque
binary plists and therefore unreadable to tooling and to anyone browsing the repository.

- **Converted:** 16 Sep 2026 from `api:/` and `knowledge:/`
- **Status:** active

## Adobe Workfront

| Link | Why it matters |
| --- | --- |
| [Workfront APIs overview](https://developer.adobe.com/workfront-apis/) | Entry point for the API surface. Confirms which API family the submission adapter targets |
| [Planning API basics](https://experienceleague.adobe.com/en/docs/workfront/using/adobe-workfront-planning/adobe-workfront-planning-general-information/planning-api-basics) | The Planning route requires OAuth via Adobe Developer Console |
| [Document webhooks overview](https://experienceleague.adobe.com/en/docs/workfront/using/adobe-workfront-api/document-webhooks-api/webhooks-overview) | Relevant to `A3IntakeSupportingFiles` — how attachments would reach Workfront |

**Standing constraint.** No live call to any of these happens without explicit approval. Credentials
are a Vendor Management Policy and privacy gate. `submitToWorkfront` is a local stub that makes no
network request.

## Monday.com

| Link | Why it matters |
| --- | --- |
| [Monday.com API reference](https://developer.monday.com/api-reference/reference/about-the-api-reference) | Named in the source requirements as a later integration target. Same vendor gate applies |

## Practice and tooling

| Link | Why it matters |
| --- | --- |
| [Nielsen Norman Group](https://www.nngroup.com/) | UX research and usability heuristics reference |
| [Figma plugin for Cursor](https://cursor.com/marketplace/figma) | Design-to-code bridge; the Figma MCP server is already available in this workspace |
