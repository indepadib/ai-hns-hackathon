# Mission Control — working agreements

This repository is a staging-only hackathon workspace. Never alter the official recruitment site, expose candidate data, or advance the shared schedule for a simulation. Preserve server-side role checks, mutual matching, version checks and existing data.

## Design and delivery references
These are selected upstream references, not installed packages or endorsements. Consult the relevant original file before each substantial change; do not execute third-party scripts blindly. No upstream text is vendored here.

- Apple Design: https://github.com/emilkowalski/skills/tree/main/skills/apple-design — instant press feedback, predictable interactions, physical continuity, restrained motion and reduced-motion support.
- Humanizer: https://github.com/blader/humanizer — concise, factual French copy; no inflated promises or filler. Keep factual meaning intact.
- Grill-me: https://github.com/mattpocock/skills/tree/main/skills/productivity/grill-me — resolve consequential product choices and dependencies with the owner, inspect the code for factual answers, don't re-ask settled decisions. The companion grilling skill is required for the full interview workflow.
- MarketingSkills: https://github.com/coreyhaines31/marketingskills/tree/main/skills/copywriting — clear primary action, audience-specific wording, evidence-based claims. In this internal event, optimize mission completion rather than commercial conversion.
- Engineering reference (selected interpretation of Engineer): https://github.com/mattpocock/skills/tree/main/skills/engineering/tdd — observable behavior and narrow test slices; agree critical interfaces. Do not claim a test passed without evidence.
- UX/UI reference (selected interpretation): https://github.com/nextlevelbuilder/ui-ux-pro-max-skill — accessibility, keyboard alternatives, responsive layouts, readable typography, contrast and consistent interaction.

## Release gate
1. Inspect existing implementation and identify the user's task and acceptance criteria.
2. Build a vertical slice with a clear primary action and genuine interaction, not a decorative mockup.
3. Verify keyboard/touch, loading/error/empty/locked/submitted states and data preservation. Maintain the select alternative for drag and drop.
4. Check actual CI and Netlify deployment. Browser and concurrent-user tests are separate from syntax/build checks.
5. Report what is verified and what remains, without presenting staging or simulation as production qualification.
