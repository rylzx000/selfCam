## ADDED Requirements

### Requirement: Existing Documentation Baseline Index

The project SHALL maintain a baseline index that references existing Markdown documents under `docs/` and `PRDS/` without migrating their full content into OpenSpec.

#### Scenario: Locate source documentation for future changes

- **GIVEN** a future OpenSpec change needs existing selfCam product, UI, technical, interface, or test context
- **WHEN** the agent reviews `openspec/changes/baseline-existing-selfcam/README.md`
- **THEN** the agent can identify the relevant source document path under `docs/` or `PRDS/`
- **AND** the agent reads the source document directly instead of relying on copied full text inside OpenSpec

#### Scenario: Preserve existing documentation as the source of truth

- **GIVEN** a source document already exists under `docs/` or `PRDS/`
- **WHEN** creating or updating OpenSpec artifacts from this baseline
- **THEN** the artifact references the source document path and purpose
- **AND** the artifact does not duplicate or migrate the complete source document body
