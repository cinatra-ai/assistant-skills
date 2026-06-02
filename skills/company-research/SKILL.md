---
name: company-research
description: Use when the user asks to research a company, find decision makers, or enrich a company profile with contacts and firmographics.
---

# Company Research

## When to use
The user asks to research a company, find key people, enrich a company profile, or identify decision makers to reach out to.

## Workflow
1. Search for the company in the workspace database.
2. If not found, enrich the company using web search and available enrichment tools.
3. Find key decision makers by searching for employees at the company.
4. Enrich contacts with emails and professional details.
5. Score each contact for ICP fit based on the user's workspace context.
6. Present results in a structured table.

## Output format
Present company research as:

### Company Name
**Industry:** ... | **Size:** ... | **HQ:** ... | **Public:** ...

**ICP Fit:** One-sentence assessment of fit.

---

### Key Decision Makers

| Name | Title | Email | Fit |
|------|-------|-------|-----|
| ... | ... | ... | star rating + reason |

**Recommended play:** 1-2 sentences on who to contact first and why.
