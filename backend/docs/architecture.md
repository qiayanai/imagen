# Architecture

This service follows a small three-layer shape.

## Layers

- `internal/httpapi`: delivery layer. It owns routing, middleware, request parsing, response DTOs, Google OAuth, and admin HTML pages.
- `internal/service`: application layer. It owns business rules: API key quota behavior, task and batch creation, provider account orchestration, task execution, and storage coordination.
- `internal/repository`: persistence layer. It owns GORM, migrations, transactions, queue claiming, quota reservation, provider account acquisition, and admin aggregate queries.

## Supporting Packages

- `internal/domain`: shared domain records and statuses used across layers.
- `internal/runner`: current image generation runner adapter.
- `internal/storage`: local and Cloudflare R2 object storage adapters.
- `internal/secret`: encrypted provider account env/token storage.
- `internal/config`: environment-driven configuration.
- `internal/worker`: background queue consumer; it calls the service layer only.

## Dependency Rules

- HTTP code calls the service layer and does not import GORM.
- Service code contains business orchestration and does not import GORM.
- Repository code is the only package that should import GORM.
- Worker code calls service methods and should not query the database directly.
- Storage, secret, and runner integrations stay behind their own packages.

If a new feature needs a database transaction, put that transaction in `internal/repository` and expose a service-level method for the business operation.
